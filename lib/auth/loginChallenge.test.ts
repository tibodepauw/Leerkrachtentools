import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "@/lib/db/sqlite";
import { CURRENT_TERMS_VERSION } from "@/lib/legal/terms";
import { RequestRateLimitError } from "@/lib/http/rateLimit";
import { POST as requestCode } from "@/app/api/auth/request-code/route";
import { POST as verify } from "@/app/api/auth/verify-code/route";
import {
  createLoginChallenge,
  getLoginChallengeCookieOptions,
  hashLoginChallenge,
  isLoginChallenge,
  LOGIN_CHALLENGE_COOKIE,
} from "./loginChallenge";
import {
  hashRequestIp,
  LOGIN_CODE_IP_DAY_SCOPE,
  requestLoginCode,
  verifyLoginCode,
} from "./service";

// No network: the mail transport is a mock that only records what it was asked
// to send. The code is read from the mocked message, as a user reads the mail.
const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/email/brevo", () => ({
  isBrevoConfigured: () => true,
  sendBrevoEmail: mail.send,
}));

const email = "eigenaar@student.thomasmore.be";
const db = () => getDatabase();
const count = (sql: string, ...args: unknown[]) =>
  (db().prepare(sql).get(...args) as { n: number }).n;
const codeRow = (challenge: string, address = email) =>
  db()
    .prepare(
      "SELECT attempts, used_at FROM login_codes WHERE email = ? AND challenge_hash = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(address, hashLoginChallenge(challenge)) as
    | { attempts: number; used_at: number | null }
    | undefined;
const lastMailedCode = () =>
  /\b(\d{6})\b/.exec(String(mail.send.mock.calls.at(-1)?.[0]?.text))?.[1] ?? "";
const wrongCode = (code: string) => (code === "111111" ? "222222" : "111111");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
  mail.send.mockReset();
  mail.send.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  for (const table of ["login_codes", "sessions", "terms_acceptances", "users", "request_rate_events"]) {
    db().prepare(`DELETE FROM ${table}`).run();
  }
});

async function settle<T>(promise: Promise<T>) {
  const handled = promise.then(
    (result) => ({ result }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const settled = await handled;
  if ("error" in settled) throw settled.error;
  return settled.result;
}

/** Requests a code from one browser and returns the code that was mailed. */
async function issue(
  challenge: string,
  overrides: Partial<Parameters<typeof requestLoginCode>[0]> = {},
) {
  const sentBefore = mail.send.mock.calls.length;
  await settle(
    requestLoginCode({
      email,
      challenge,
      ipHash: hashRequestIp("192.0.2.1"),
      ipTrusted: true,
      marketingOptIn: false,
      privacyAccepted: true,
      termsVersion: CURRENT_TERMS_VERSION,
      ...overrides,
    }),
  );
  return mail.send.mock.calls.length > sentBefore ? lastMailedCode() : "";
}

function verifyRequest(address: string, code: string, challenge?: string) {
  return verify(
    new Request("http://localhost/api/auth/verify-code", {
      method: "POST",
      headers: challenge ? { cookie: `${LOGIN_CHALLENGE_COOKIE}=${challenge}` } : {},
      body: JSON.stringify({ email: address, code }),
    }),
  );
}

describe("browsergebonden logincode", () => {
  it("laat browser B de code en pogingen van browser A ongemoeid", async () => {
    const a = createLoginChallenge();
    const b = createLoginChallenge();
    const codeA = await issue(a);
    const codeB = await issue(b);
    expect(mail.send).toHaveBeenCalledTimes(2);
    // A second request from another browser does not revoke the first code.
    expect(codeRow(a)).toEqual({ attempts: 0, used_at: null });

    // B knows A's code but not A's nonce: it only ever reaches its own row.
    expect(() => verifyLoginCode(email, wrongCode(codeB), b)).toThrow("niet correct");
    if (codeA !== codeB) {
      expect(() => verifyLoginCode(email, codeA, b)).toThrow("niet correct");
    }
    for (let i = 0; i < 6; i += 1) {
      expect(() => verifyLoginCode(email, wrongCode(codeB), b)).toThrow();
    }
    expect(codeRow(b)?.attempts).toBe(5);
    expect(codeRow(a)).toEqual({ attempts: 0, used_at: null });

    // An unknown nonce selects nothing at all.
    expect(() => verifyLoginCode(email, codeA, createLoginChallenge())).toThrow("verlopen");
    expect(codeRow(a)).toEqual({ attempts: 0, used_at: null });

    expect(verifyLoginCode(email, codeA, a).user.email).toBe(email);
  });

  it("boekt geen verificatiebucket van de eigenaar wanneer een andere browser blijft raden", async () => {
    const owner = createLoginChallenge();
    const attacker = createLoginChallenge();
    const ownerCode = await issue(owner);
    const attackerCode = await issue(attacker);

    // No cookie and a foreign cookie: rejected before any counter is touched.
    expect((await verifyRequest(email, ownerCode)).status).toBe(400);
    expect((await verifyRequest(email, ownerCode, createLoginChallenge())).status).toBe(400);
    expect(count("SELECT COUNT(*) AS n FROM request_rate_events WHERE scope LIKE 'otp-verify%'")).toBe(0);

    // The attacker holds an own pending code for the same address and uses up
    // every verification its own browser is allowed.
    const statuses: number[] = [];
    for (let i = 0; i < 31; i += 1) {
      statuses.push((await verifyRequest(email, wrongCode(attackerCode), attacker)).status);
    }
    expect(statuses.at(-1)).toBe(429);
    expect(codeRow(owner)).toEqual({ attempts: 0, used_at: null });

    const response = await verifyRequest(email, ownerCode, owner);
    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie();
    expect(cookies.some((cookie) => cookie.startsWith(`${LOGIN_CHALLENGE_COOKIE}=;`) && /Max-Age=0/i.test(cookie))).toBe(true);
  });

  it("blokkeert na vijf foute pogingen ook de juiste code", async () => {
    const challenge = createLoginChallenge();
    const code = await issue(challenge);
    for (let i = 0; i < 5; i += 1) {
      expect(() => verifyLoginCode(email, wrongCode(code), challenge)).toThrow("niet correct");
    }
    expect(() => verifyLoginCode(email, code, challenge)).toThrow("Te veel mislukte pogingen");
    expect(count("SELECT COUNT(*) AS n FROM sessions")).toBe(0);
  });

  it("verifieert geen code zonder challenge uit de periode voor de schema-update", () => {
    const columns = (db().prepare("PRAGMA table_info(login_codes)").all() as { name: string }[]).map((column) => column.name);
    expect(columns).toContain("challenge_hash");
    const now = Date.now();
    db().prepare(
      "INSERT INTO login_codes (id, email, code_hash, ip_hash, privacy_accepted, expires_at, created_at) VALUES ('legacy', ?, 'x', 'ip', 1, ?, ?)",
    ).run(email, now + 60_000, now);
    expect(() => verifyLoginCode(email, "123456", createLoginChallenge())).toThrow("verlopen");
    expect(db().prepare("SELECT attempts FROM login_codes WHERE id = 'legacy'").get()).toEqual({ attempts: 0 });
  });

  it("weigert een misvormde challenge in aanvraag en verificatie", async () => {
    expect(isLoginChallenge("kort")).toBe(false);
    expect(isLoginChallenge(createLoginChallenge())).toBe(true);
    await expect(issue("kort")).rejects.toThrow();
    expect(() => verifyLoginCode(email, "123456", "kort")).toThrow("verlopen");
    expect(mail.send).not.toHaveBeenCalled();
    expect(count("SELECT COUNT(*) AS n FROM login_codes")).toBe(0);
  });
});

describe("herhaalde en gelijktijdige aanvragen", () => {
  it("beantwoordt een herhaling uit dezelfde browser zonder tweede mail of extra rijen", async () => {
    const challenge = createLoginChallenge();
    const code = await issue(challenge);
    // Second tab or double submit: same browser, same address, within a minute.
    expect(await issue(challenge)).toBe("");
    expect(await issue(challenge)).toBe("");
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(count("SELECT COUNT(*) AS n FROM login_codes")).toBe(1);
    expect(count("SELECT COUNT(*) AS n FROM request_rate_events WHERE scope = ?", LOGIN_CODE_IP_DAY_SCOPE)).toBe(1);
    expect(verifyLoginCode(email, code, challenge).user.email).toBe(email);
  });

  it("stuurt bij gelijktijdige aanvragen uit één browser één mail", async () => {
    const challenge = createLoginChallenge();
    const input = {
      email,
      challenge,
      ipHash: hashRequestIp("192.0.2.1"),
      ipTrusted: true,
      marketingOptIn: false,
      privacyAccepted: true,
      termsVersion: CURRENT_TERMS_VERSION,
    };
    await settle(Promise.all([requestLoginCode(input), requestLoginCode(input), requestLoginCode(input)]));
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(count("SELECT COUNT(*) AS n FROM login_codes")).toBe(1);
  });

  it("vervangt na de wachttijd alleen de eigen oudere code", async () => {
    const a = createLoginChallenge();
    const b = createLoginChallenge();
    const first = await issue(a);
    const other = await issue(b);
    vi.advanceTimersByTime(61_000);
    const second = await issue(a);
    expect(mail.send).toHaveBeenCalledTimes(3);
    expect(count("SELECT COUNT(*) AS n FROM login_codes WHERE used_at IS NULL")).toBe(2);
    if (first !== second) {
      expect(() => verifyLoginCode(email, first, a)).toThrow("niet correct");
    }
    expect(codeRow(b)).toEqual({ attempts: 0, used_at: null });
    expect(verifyLoginCode(email, second, a).user.email).toBe(email);
    expect(verifyLoginCode(email, other, b).user.email).toBe(email);
  });

  it("trekt de code in wanneer de mail mislukt en laat dan een minuut wachten", async () => {
    const challenge = createLoginChallenge();
    mail.send.mockRejectedValueOnce(new Error("synthetic transport failure"));
    await expect(issue(challenge)).rejects.toThrow("synthetic transport failure");
    expect(codeRow(challenge)?.used_at).not.toBeNull();
    await expect(issue(challenge)).rejects.toBeInstanceOf(RequestRateLimitError);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it("houdt de adreslimiet over alle browsers: restrisico voor het adres, bestaande code blijft bruikbaar", async () => {
    const owner = createLoginChallenge();
    const code = await issue(owner);
    for (let i = 0; i < 4; i += 1) await issue(createLoginChallenge());
    expect(mail.send).toHaveBeenCalledTimes(5);
    // Documented residual risk: the address budget is used up by other browsers.
    await expect(issue(createLoginChallenge())).rejects.toBeInstanceOf(RequestRateLimitError);
    expect(mail.send).toHaveBeenCalledTimes(5);
    expect(count("SELECT COUNT(*) AS n FROM login_codes")).toBe(5);
    // The code the owner already had is not affected.
    expect(verifyLoginCode(email, code, owner).user.email).toBe(email);
  });

  it("behandelt een adres zonder toegang gelijk, zonder mail en zonder sessie", async () => {
    const outsider = "buitenstaander@example.com";
    const challenge = createLoginChallenge();
    const response = await settle(
      requestCode(
        new Request("http://localhost/api/auth/request-code", {
          method: "POST",
          headers: { cookie: `${LOGIN_CHALLENGE_COOKIE}=${challenge}` },
          body: JSON.stringify({ email: outsider, privacyAccepted: true, termsVersion: CURRENT_TERMS_VERSION }),
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith(`${LOGIN_CHALLENGE_COOKIE}=${challenge}`))).toBe(true);
    expect(mail.send).not.toHaveBeenCalled();
    expect((await verifyRequest(outsider, "123456", challenge)).status).toBe(400);
    expect(() => verifyLoginCode(outsider, "123456", challenge)).toThrow("niet correct");
    expect(count("SELECT COUNT(*) AS n FROM sessions")).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM users")).toBe(0);
  });
});

describe("marketingtoestemming bij inloggen", () => {
  it.each([[true, false], [false, true]])("verwerkt de nieuwste keuze bij herhaling: %s naar %s", async (firstChoice, latestChoice) => {
    const challenge = createLoginChallenge();
    const firstCode = await issue(challenge, { marketingOptIn: firstChoice });
    vi.advanceTimersByTime(20_000);
    await issue(challenge, { marketingOptIn: latestChoice });
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(verifyLoginCode(email, firstCode, challenge).user.marketingOptIn).toBe(latestChoice);
    const row = db().prepare("SELECT marketing_opt_in, marketing_consent_at FROM users WHERE email=?").get(email) as { marketing_opt_in: number; marketing_consent_at: number | null };
    expect(row.marketing_opt_in).toBe(Number(latestChoice));
    if (latestChoice) expect(row.marketing_consent_at).toBeGreaterThan(0);
    else expect(row.marketing_consent_at).toBeNull();
  });
  async function login(marketingOptIn: boolean) {
    const challenge = createLoginChallenge();
    const code = await issue(challenge, { marketingOptIn });
    const result = verifyLoginCode(email, code, challenge);
    vi.advanceTimersByTime(61_000);
    return result;
  }
  const consent = () =>
    db().prepare("SELECT marketing_opt_in, marketing_consent_at FROM users WHERE email = ?").get(email) as {
      marketing_opt_in: number;
      marketing_consent_at: number | null;
    };

  it("neemt de keuze alleen over bij een nieuw account", async () => {
    expect((await login(true)).user.marketingOptIn).toBe(true);
    const first = consent();
    expect(first.marketing_opt_in).toBe(1);
    expect(first.marketing_consent_at).toBeGreaterThan(0);
    // A later login without the box does not withdraw it either.
    await login(false);
    expect(consent()).toEqual(first);
  });

  it("zet bij een bestaand account geen toestemming via een aanvraag", async () => {
    await login(false);
    expect(consent()).toEqual({ marketing_opt_in: 0, marketing_consent_at: null });
    expect((await login(true)).user.marketingOptIn).toBe(false);
    expect(consent()).toEqual({ marketing_opt_in: 0, marketing_consent_at: null });
  });
});

describe("daglimiet per vertrouwd IP", () => {
  const dayEvents = (ip: string) =>
    count("SELECT COUNT(*) AS n FROM request_rate_events WHERE scope = ? AND subject = ?", LOGIN_CODE_IP_DAY_SCOPE, hashRequestIp(ip));
  const address = (index: number) => `leerling${index}@student.thomasmore.be`;

  it("weigert het volgende verzoek zonder mail, code of tellerrij en raakt andere IP's niet", async () => {
    vi.stubEnv("LOGIN_CODE_IP_DAILY_LIMIT", "3");
    for (let i = 0; i < 3; i += 1) {
      await issue(createLoginChallenge(), { email: address(i) });
      vi.advanceTimersByTime(20 * 60_000);
    }
    expect(dayEvents("192.0.2.1")).toBe(3);
    await expect(issue(createLoginChallenge(), { email: address(3) })).rejects.toBeInstanceOf(RequestRateLimitError);
    expect(mail.send).toHaveBeenCalledTimes(3);
    expect(dayEvents("192.0.2.1")).toBe(3);
    expect(count("SELECT COUNT(*) AS n FROM login_codes WHERE email = ?", address(3))).toBe(0);
    // The counter holds a keyed hash, never the address itself.
    expect(count("SELECT COUNT(*) AS n FROM request_rate_events WHERE subject LIKE '%192.0.2.1%'")).toBe(0);

    await issue(createLoginChallenge(), { email: address(4), ipHash: hashRequestIp("192.0.2.2") });
    expect(mail.send).toHaveBeenCalledTimes(4);

    // The window slides: a day later the first address may request again.
    vi.advanceTimersByTime(24 * 60 * 60_000);
    await issue(createLoginChallenge(), { email: address(5) });
    expect(mail.send).toHaveBeenCalledTimes(5);
  });

  it("geeft een onbekend IP geen gedeelde dagbucket", async () => {
    vi.stubEnv("LOGIN_CODE_IP_DAILY_LIMIT", "1");
    const unknown = { ipHash: hashRequestIp("unavailable"), ipTrusted: false };
    for (let i = 0; i < 3; i += 1) {
      await issue(createLoginChallenge(), { email: address(i), ...unknown });
    }
    expect(mail.send).toHaveBeenCalledTimes(3);
    expect(count("SELECT COUNT(*) AS n FROM request_rate_events WHERE scope = ?", LOGIN_CODE_IP_DAY_SCOPE)).toBe(0);
  });

  it("valt bij een ongeldige instelling terug op 30", async () => {
    vi.stubEnv("LOGIN_CODE_IP_DAILY_LIMIT", "0");
    const now = Date.now();
    const insert = db().prepare("INSERT INTO request_rate_events (scope, subject, created_at) VALUES (?, ?, ?)");
    for (let i = 0; i < 29; i += 1) insert.run(LOGIN_CODE_IP_DAY_SCOPE, hashRequestIp("192.0.2.1"), now - 60 * 60_000);
    await issue(createLoginChallenge(), { email: address(0) });
    await expect(issue(createLoginChallenge(), { email: address(1) })).rejects.toThrow("morgen");
    expect(mail.send).toHaveBeenCalledTimes(1);
  });
});

describe("challengecookie", () => {
  it("zet een HttpOnly Strict-cookie en hergebruikt de nonce voor een tweede tabblad", async () => {
    const post = (address: string, cookie?: string) =>
      settle(
        requestCode(
          new Request("http://localhost/api/auth/request-code", {
            method: "POST",
            headers: cookie ? { cookie } : {},
            body: JSON.stringify({ email: address, privacyAccepted: true, termsVersion: CURRENT_TERMS_VERSION }),
          }),
        ),
      );
    const first = await post(email);
    expect(first.status).toBe(200);
    const setCookie = first.headers.getSetCookie().find((cookie) => cookie.startsWith(`${LOGIN_CHALLENGE_COOKIE}=`))!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=strict/i);
    expect(setCookie).toMatch(/Path=\//i);
    expect(setCookie).toMatch(/Max-Age=900/i);
    const pair = setCookie.split(";")[0];
    expect(isLoginChallenge(pair.slice(LOGIN_CHALLENGE_COOKIE.length + 1))).toBe(true);
    // Neither the nonce nor a code is ever returned in the body.
    expect(JSON.stringify(await first.json())).not.toContain(pair.slice(LOGIN_CHALLENGE_COOKIE.length + 1));

    const second = await post("collega@student.thomasmore.be", pair);
    expect(second.headers.getSetCookie().some((cookie) => cookie.startsWith(pair))).toBe(true);
    expect(count("SELECT COUNT(DISTINCT challenge_hash) AS n FROM login_codes")).toBe(1);
    // Both tabs can finish with the one shared cookie.
    expect((await verifyRequest(email, /\b(\d{6})\b/.exec(String(mail.send.mock.calls[0][0].text))![1], pair.slice(LOGIN_CHALLENGE_COOKIE.length + 1))).status).toBe(200);
  });

  it("gebruikt in productie een Secure __Host-cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const production = await import("./loginChallenge");
    expect(production.LOGIN_CHALLENGE_COOKIE).toBe("__Host-leerkrachtentools_login");
    expect(production.getLoginChallengeCookieOptions()).toMatchObject({ httpOnly: true, secure: true, sameSite: "strict", path: "/" });
    expect(getLoginChallengeCookieOptions()).not.toHaveProperty("domain");
  });
});
