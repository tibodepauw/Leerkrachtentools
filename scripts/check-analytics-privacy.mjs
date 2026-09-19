import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { build } from "esbuild";
import { chromium } from "playwright";

// Mount the real provider and SDK. All network traffic is intercepted locally;
// the project key, lesson, URL and browser profile are synthetic.
const bundle = await build({
  stdin: { contents: `import React from 'react';
    import { createRoot } from 'react-dom/client';
    import posthog from 'posthog-js';
    import { PostHogProvider } from './components/providers/posthog-provider';
    createRoot(document.getElementById('root')).render(React.createElement(PostHogProvider, null, React.createElement('button', { id: 'lesson' }, 'PRIVATE_LESSON')));
    window.analyticsProbe = posthog;`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", tsconfig: "tsconfig.json",
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_POSTHOG_KEY": '"phc_synthetic_public_test_key"', "process.env.NEXT_PUBLIC_POSTHOG_HOST": '"https://analytics.example"' },
  plugins: [{ name: "synthetic-route", setup(builder) {
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "route", namespace: "probe" }));
    builder.onLoad({ filter: /.*/, namespace: "probe" }, () => ({ contents: 'export function usePathname() { return "/settings"; }' }));
  } }],
});
const browser = await chromium.launch({ headless: true, ...(process.env.SECURITY_BROWSER_CHANNEL ? { channel: process.env.SECURITY_BROWSER_CHANNEL } : {}) });
try {
  // Exercise the normal user path; PostHog intentionally drops headless-bot UAs.
  const context = await browser.newContext({ serviceWorkers: "block", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" });
  await context.addInitScript(() => {
    // Simulate a normal user so bot filtering cannot make this test pass silently.
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    // Chromium Headless Shell also advertises a bot brand in client hints.
    // Keep native methods bound to the original UAData object.
    const hints = navigator.userAgentData;
    if (hints) Object.defineProperty(navigator, "userAgentData", { value: new Proxy(hints, {
      get(target, property) {
        if (property === "brands") return [{ brand: "Chromium", version: "140" }];
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) });
  });
  const requests = [];
  await context.route("**/*", async route => {
    const request = route.request();
    if (new URL(request.url()).host === "127.0.0.1:18998") {
      return route.fulfill({ contentType: "text/html", body: '<!doctype html><title>PRIVATE_TITLE</title><div id="root"></div><input value="PRIVATE_PUPIL">' });
    }
    let bytes = request.postDataBuffer();
    if (bytes?.[0] === 0x1f && bytes?.[1] === 0x8b) bytes = gunzipSync(bytes);
    requests.push({ url: request.url(), body: bytes?.toString() ?? "", headers: request.headers() });
    await route.fulfill({ contentType: "application/json", body: '{"status":1}' });
  });
  const page = await context.newPage();
  page.on("pageerror", error => console.error("Synthetic analytics browser error:", error.message));
  await page.goto("http://127.0.0.1:18998/settings?email=PRIVATE_EMAIL#PRIVATE_KEY", { referer: "https://school.example/PRIVATE_REFERRER" });
  await page.evaluate(() => {
    const key = "ph_phc_synthetic_public_test_key_posthog";
    localStorage.setItem(key, JSON.stringify({ distinct_id: "synthetic-old-anonymous-id", $initial_referrer: "PRIVATE_OLD_REFERRER" }));
    sessionStorage.setItem(key, JSON.stringify({ $referrer: "PRIVATE_OLD_REFERRER" }));
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.waitForFunction(() => window.analyticsProbe?.config?.token === "phc_synthetic_public_test_key");
  const pageviews = () => requests.reduce((count, r) => count + (r.body.match(/"\$pageview"/g)?.length ?? 0), 0);
  const waitForPageviews = async count => {
    const deadline = Date.now() + 12_000;
    while (pageviews() < count && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(pageviews() >= count, `Expected ${count} real SDK pageviews, received ${pageviews()}`);
  };
  // The first real route pageview must work without manually calling capture.
  await waitForPageviews(1);
  await page.locator("#lesson").click();
  const captured = await page.evaluate(() => {
    const p = window.analyticsProbe;
    p.capture("$autocapture", { text: "PRIVATE_AUTOCAPTURE" });
    p.capture("$exception", { message: "PRIVATE_EXCEPTION" });
    return { event: p.capture("$pageview", { $current_url: location.href, $referrer: "https://school.example/PRIVATE_REFERRER", $set: { email: "PRIVATE_EMAIL" }, lesson: "PRIVATE_LESSON" }, { send_instantly: true }), loaded: p.__loaded, consent: p.has_opted_out_capturing(), storage: { ...localStorage }, session: { ...sessionStorage } };
  });
  await waitForPageviews(2);
  assert.ok(requests.some(r => r.body.includes('"$pageview"')), `A real SDK pageview must reach the intercepted transport: ${JSON.stringify({ requests, captured })}`);
  assert.ok(requests.every(r => new URL(r.url).hostname === "analytics.example"), "Unexpected SDK service or script request");
  assert.ok(!JSON.stringify(requests).includes("PRIVATE_"), "Private DOM, URL or event data reached the transport");
  const events = requests.flatMap(r => {
    if (!r.body) return [];
    const data = JSON.parse(r.body);
    return data.batch ?? data;
  }).flat();
  assert.ok(events.length > 0);
  for (const event of events) {
    assert.equal(event.event, "$pageview", JSON.stringify(event));
    assert.equal(event.properties.$current_url, "http://127.0.0.1:18998/settings");
    assert.equal(event.properties.$pathname, "/settings");
  }
  const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, cookies: document.cookie }));
  assert.ok(!JSON.stringify(storage).includes("PRIVATE_"), "Private event data persisted in SDK browser storage");
  console.log(`Analytics wire privacy passed: ${events.length} sanitized pageview(s), no private URL/DOM/event fields or external SDK scripts.`);
} finally { await browser.close(); }
