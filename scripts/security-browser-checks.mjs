import assert from "node:assert/strict";
import { chromium } from "playwright";

export async function checkBrowserSessions({ origin, token, secondToken, userId }) {
  const browser = await chromium.launch({ headless: true, ...(process.env.SECURITY_BROWSER_CHANNEL ? { channel: process.env.SECURITY_BROWSER_CHANNEL } : {}) });
  try {
    // Synthetic OTP endpoints: never sends mail or creates a real session.
    const login = await browser.newContext({ serviceWorkers: "block" });
    let verificationCalls = 0;
    await login.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/api/auth/request-code") return route.fulfill({ json: { ok: true } });
      if (url.pathname === "/api/auth/verify-code") { verificationCalls++; return route.fulfill({ json: { ok: true } }); }
      return route.continue();
    });
    await login.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException("Synthetic full storage", "QuotaExceededError"); }; });
    const loginPage = await login.newPage();
    loginPage.on("pageerror", error => console.error("Synthetic login page error:", error.message));
    await loginPage.goto(origin);
    await loginPage.locator("#shared-device").check();
    await loginPage.locator("#email").fill("synthetic@example.test");
    await loginPage.locator("#privacy").check();
    await loginPage.getByRole("button", { name: "Stuur verificatiecode", exact: true }).click();
    await loginPage.locator("#code").fill("123456");
    await loginPage.getByRole("button", { name: "Inloggen", exact: true }).click();
    await loginPage.getByRole("alert").filter({ hasText: "Je opslagkeuze kon niet worden bewaard" }).waitFor({ state: "visible" });
    assert.equal(verificationCalls, 0, "Do not create a session before the shared-device choice is safely saved");
    await login.close();
    const context = await browser.newContext({ serviceWorkers: "block" });
    // No external requests, telemetry, provider calls or real browser profile.
    await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addCookies([{ name: "__Host-leerkrachtentools_session", value: token, url: origin.replace(/^http:/, "https:"), secure: true, httpOnly: true, sameSite: "Lax" }]);
    const first = await context.newPage();
    await first.goto(`${origin}/offline`);
    await first.evaluate((id) => {
      localStorage.setItem("leerkrachtentools-shared-device", "true");
      localStorage.setItem(`leerkrachtentools-active-lesson:${id}`, "private old lesson");
    }, userId);
    await first.goto(`${origin}/settings`);
    await first.locator("#account-email").waitFor({ state: "visible" });
    assert.equal(await first.locator("#account-email").inputValue(), "smoke@example.test");
    assert.equal(await first.evaluate((id) => localStorage.getItem(`leerkrachtentools-active-lesson:${id}`), userId), null);
    await context.setOffline(true);
    await first.evaluate(() => window.dispatchEvent(new Event("focus")));
    await first.locator("#account-email").waitFor({ state: "hidden" });
    await context.setOffline(false);
    await first.evaluate(() => window.dispatchEvent(new Event("focus")));
    await first.locator("#account-email").waitFor({ state: "visible" });
    await first.goto(`${origin}/offline`);
    await first.goBack();
    await first.locator("#account-email").waitFor({ state: "visible" });
    // Simulate a login to another account in a different window. A stale tab
    // must discard A's UI before showing B under the new shared cookie.
    await context.addCookies([{ name: "__Host-leerkrachtentools_session", value: secondToken, url: origin.replace(/^http:/, "https:"), secure: true, httpOnly: true, sameSite: "Lax" }]);
    await first.evaluate(() => window.dispatchEvent(new Event("focus")));
    await first.waitForURL(`${origin}/`);
    await first.goto(`${origin}/settings`);
    await first.locator("#account-email").waitFor({ state: "visible" });
    assert.equal(await first.locator("#account-email").inputValue(), "second@example.test");
    const second = await context.newPage();
    await second.goto(`${origin}/settings`);
    await second.getByRole("button", { name: "Uitloggen", exact: true }).click();
    await first.getByText("Log in met je e-mailadres", { exact: true }).waitFor({ state: "visible" });
    await second.getByText("Log in met je e-mailadres", { exact: true }).waitFor({ state: "visible" });
    assert.equal(await first.locator("#account-email").count(), 0);
    // Closing/reopening a tab must not recover the logged-out account UI.
    await first.close();
    const reopened = await context.newPage();
    await reopened.goto(`${origin}/settings`);
    await reopened.getByText("Log in met je e-mailadres", { exact: true }).waitFor({ state: "visible" });
    assert.equal(await reopened.locator("#account-email").count(), 0);
    // Storage denial must fail closed, with an explicit recovery message.
    const blocked = await browser.newContext({ serviceWorkers: "block" });
    await blocked.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await blocked.addCookies([{ name: "__Host-leerkrachtentools_session", value: token, url: origin.replace(/^http:/, "https:"), secure: true, httpOnly: true, sameSite: "Lax" }]);
    await blocked.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Synthetic storage denial", "SecurityError"); } }); });
    const denied = await blocked.newPage();
    await denied.goto(`${origin}/settings`);
    await denied.getByRole("alert").filter({ hasText: "Browseropslag kon niet veilig" }).waitFor({ state: "visible" });
    assert.equal(await denied.locator("#account-email").count(), 0);
    await blocked.close();
    console.log("Browser security passed: shared storage purge, offline masking, history return, account switch, logout across two tabs.");
    console.log("Browser storage edge cases passed: reopen after logout and explicit fail-closed storage denial.");
  } finally { await browser.close(); }
}
