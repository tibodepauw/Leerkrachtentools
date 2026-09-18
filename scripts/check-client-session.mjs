import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

// Real IndexedDB with synthetic data in a disposable browser profile. No server,
// external requests, personal storage or provider credentials are used.
const bundle = await build({
  stdin: { contents: `import * as scope from './lib/storage/userStorageScope';
    import * as documents from './lib/documents/documentStorage';
    import * as cache from './lib/rag/clientQueryCache';
    window.storageProbe = { ...scope, ...documents, ...cache };`, resolveDir: process.cwd() },
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
    localStorage.setItem("leerkrachtentools-shared-device", "true");
    s.writeRagQueryCache("rag-curriculum", "LAGER", "ALL", "private query", { data: { goal: "private cache" }, provider: "synthetic", fallbackErrors: [] });
    const ownCache = s.readRagQueryCache("rag-curriculum", "LAGER", "ALL", "private query").data.goal;
    s.setActiveUserId("C");
    const otherCache = s.readRagQueryCache("rag-curriculum", "LAGER", "ALL", "private query");
    return { normal, rejectedRead, rejectedWrite, missing, otherAccount, oldAborted: old.signal.aborted, ownCache, otherCache, persistedCacheEntries: sessionStorage.length };
  });
  assert.deepEqual(result, { normal: "private A", rejectedRead: true, rejectedWrite: true, missing: null, otherAccount: null, oldAborted: true, ownCache: "private cache", otherCache: null, persistedCacheEntries: 0 });
  console.log("Client session isolation passed: committed IndexedDB writes, account separation and rejection of late reads/writes across logout and re-login.");
  console.log("Shared-device query cache passed: account-scoped results in memory, no sessionStorage persistence.");
} finally { await browser.close(); }
