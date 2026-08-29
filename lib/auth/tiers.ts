import "server-only";

export const USER_TIERS = [
  "student",
  "tester",
  "partner",
  "admin",
  "unapproved",
] as const;

export type UserTier = (typeof USER_TIERS)[number];

const ADMIN_EMAIL = "r1058655@student.thomasmore.be";

const THOMAS_MORE_DOMAINS = ["@student.thomasmore.be", "@thomasmore.be"];

export const DAILY_SERVER_AI_LIMITS: Record<UserTier, number> = {
  student: 40,
  tester: 60,
  partner: 100,
  admin: 1000,
  unapproved: 0,
};

export function isUserTier(value: string): value is UserTier {
  return (USER_TIERS as readonly string[]).includes(value);
}

function parseEmailAllowlist(raw: string | undefined) {
  if (!raw?.trim()) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function testerEmails() {
  return parseEmailAllowlist(process.env.TESTER_EMAILS);
}

function partnerEmails() {
  return parseEmailAllowlist(process.env.PARTNER_EMAILS);
}

export function resolveTierFromEmail(email: string): UserTier {
  const normalized = email.trim().toLowerCase();

  if (normalized === ADMIN_EMAIL) {
    return "admin";
  }

  if (THOMAS_MORE_DOMAINS.some((domain) => normalized.endsWith(domain))) {
    return "student";
  }

  if (testerEmails().has(normalized)) {
    return "tester";
  }

  if (partnerEmails().has(normalized)) {
    return "partner";
  }

  return "unapproved";
}

export function isApprovedTier(tier: string): tier is Exclude<UserTier, "unapproved"> {
  return tier !== "unapproved" && isUserTier(tier);
}

export function dailyServerAiLimit(tier: string) {
  if (isUserTier(tier)) return DAILY_SERVER_AI_LIMITS[tier];
  return DAILY_SERVER_AI_LIMITS.unapproved;
}

export function inviteOnlyMessage() {
  return "Leerkrachtentools is invite-only. Je account heeft nog geen toegang. Neem contact op met de beheerder om een uitnodiging te ontvangen.";
}

export function dailyAiLimitMessage(limit: number) {
  return `Je hebt je dagelijkse limiet van ${limit} AI-analyses bereikt. Vul je eigen API-key in onder Instellingen om onbeperkt door te werken, of wacht tot morgen.`;
}
