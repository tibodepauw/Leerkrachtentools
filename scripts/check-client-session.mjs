import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

// Real IndexedDB with synthetic data in a disposable browser profile. No server,
// external requests, personal storage or provider credentials are used.
const bundle = await build({
  stdin: { contents: `import * as scope from './lib/storage/userStorageScope';
    import * as documents from './lib/documents/documentStorage';
    window.storageProbe = { ...scope, ...documents };`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", tsconfig: "tsconfig.json",
});
const browser = await chromium.launch({ headless: true, ...(process.env.SECURITY_BROWSER_CHANNEL ? { channel: process.env.SECURITY_BROWSER_CHANNEL } : {}) });
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/*", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Synthetic session storage test</title>" }));
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:18999/");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const s = window.storageProbe;
    s.setActiveUserId("A");
    await s.saveLessonDocument("committed", new Blob(["private A"]));
    const normal = await (await s.getLessonDocument("committed")).text();
    const lateRead = s.getLessonDocument("committed").then(() => false, () => true);
    s.setActiveUserId("B");
    const rejectedRead = await lateRead;
    const lateWrite = s.saveLessonDocument("late", new Blob(["private B"])).then(() => false, () => true);
    s.setActiveUserId(null);
    s.setActiveUserId("B");
    const rejectedWrite = await lateWrite;
    const missing = await s.getLessonDocument("late");
    const otherAccount = await s.getLessonDocument("committed");
    const old = s.captureStorageSession();
    s.setActiveUserId(null); s.setActiveUserId("B");
    return { normal, rejectedRead, rejectedWrite, missing, otherAccount, oldAborted: old.signal.aborted };
  });
  assert.deepEqual(result, { normal: "private A", rejectedRead: true, rejectedWrite: true, missing: null, otherAccount: null, oldAborted: true });
  console.log("Client session isolation passed: committed IndexedDB writes, account separation and rejection of late reads/writes across logout and re-login.");
} finally { await browser.close(); }
