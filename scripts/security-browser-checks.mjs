import assert from "node:assert/strict";
import { chromium } from "playwright";

export async function checkBrowserSessions({ origin, token, secondToken, userId }) {
  const browser = await chromium.launch({ headless: true, ...(process.env.SECURITY_BROWSER_CHANNEL ? { channel: process.env.SECURITY_BROWSER_CHANNEL } : {}) });
  try {
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
    console.log("Browser security passed: shared storage purge, offline masking, history return, account switch, logout across two tabs.");
  } finally { await browser.close(); }
}
