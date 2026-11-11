import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const bracePaths = Object.keys(lock.packages).filter(p => p.endsWith("/brace-expansion"));
it.each(bracePaths)("keeps hostile brace parsing bounded with normal expansion intact: %s", packagePath => {
  // Hostile synchronous parsing must never run unbounded inside Vitest.
  const source = `const assert=require('node:assert/strict'); const m=require(${JSON.stringify(path.resolve(packagePath))});
    const expand=m.expand || m;
    assert.deepEqual(expand('lesson-{a,b}.txt'),['lesson-a.txt','lesson-b.txt']);
    for(const pattern of ['{'+ '{a},'.repeat(7000)+'b}', '{{x},'+'a,'.repeat(125000)+'b}',
       '{'.repeat(3200)+'a,b'+'}'.repeat(3200), '{a}'+'}'.repeat(32000)+',z}']) assert(Array.isArray(expand(pattern)));
    console.log('bounded');`;
  expect(execFileSync(process.execPath, ["--max-old-space-size=64", "-e", source], { encoding: "utf8", timeout: 4000, stdio: "pipe" }).trim()).toBe("bounded");
});
it("rejects malformed URI authorities and ports and normalizes escaped host case", () => {
  if (!lock.packages["node_modules/fast-uri"]) {
    expect(Object.keys(lock.packages).some(p => p.endsWith("/fast-uri"))).toBe(false);
    return;
  }
  const uri = require("fast-uri");
  expect(uri.parse("http://[127.0.0.1/").error).toBeTruthy();
  expect(uri.parse("http://example.test]/").error).toBeTruthy();
  expect(() => uri.serialize({ scheme: "http", host: "trusted.example", port: "@127.0.0.1:8124", path: "/app" })).toThrow();
  expect(uri.parse("//%41.com").host).toBe("a.com"); expect(uri.equal("//%41.com", "//a.com")).toBe(true);
  expect(uri.serialize({ scheme: "http", host: "example.test", port: 8124, path: "/lesson" })).toBe("http://example.test:8124/lesson");
});
it("classifies special-use IPv6, rejects cross-family subnets and bounds diagnostics", () => {
  if (!lock.packages["node_modules/ip-address"]) {
    expect(Object.keys(lock.packages).some(p => p.endsWith("/ip-address"))).toBe(false);
    return;
  }
  const { Address4, Address6, AddressError } = require("ip-address");
  expect(new Address6("64:ff9b:1::7f00:1").isPrivate()).toBe(true);
  expect(new Address6("fe81::1").isLinkLocal()).toBe(true);
  expect(new Address6("a00::1").isInSubnet(new Address4("10.0.0.0/8"))).toBe(false);
  expect(new Address4("32.0.0.1").isHostInSubnet(new Address6("2000::/3"))).toBe(false);
  expect(new Address4("10.1.2.3").isInSubnet(new Address4("10.0.0.0/8"))).toBe(true);
  try { new Address6("!".repeat(1024 * 1024)); throw new Error("Accepted oversized IP"); }
  catch (error) { expect(error).toBeInstanceOf(AddressError); expect(error.message.length).toBeLessThan(256); }
});
it.each(["unsafe method", "shared Set-Cookie"])("does not replay %s through Undici's real cache interceptor", async scenario => {
  const { MockAgent, interceptors } = require("undici");
  const agent = new MockAgent(); agent.disableNetConnect();
  const pool = agent.get("http://provider.example.test");
  const dispatcher = agent.compose(interceptors.cache());
  const method = scenario === "unsafe method" ? "POST" : "GET";
  for (let index = 0; index < 2; index++) {
    pool.intercept({ path: "/synthetic", method }).reply(scenario === "unsafe method" ? 404 : 200, `reply-${index}`, {
      headers: { "cache-control": "public, max-age=600", ...(method === "GET" ? { "set-cookie": `synthetic=${index}` } : {}) },
    });
  }
  try {
    for (let index = 0; index < 2; index++) {
      const response = await dispatcher.request({ origin: "http://provider.example.test", path: "/synthetic", method });
      expect(await response.body.text()).toBe(`reply-${index}`);
    }
    agent.assertNoPendingInterceptors();
  } finally { await agent.close(); }
});
