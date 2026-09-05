import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sw = readFileSync("public/sw.js", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");
const settings = readFileSync("components/auth/AccountSettings.tsx", "utf8");

describe("PWA service worker", () => {
  it("vangt navigatie netwerk-first af en slaat /api/ over", () => {
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toContain("request.method !== \"GET\"");
    expect(sw).toContain('event.request.mode === "navigate"');
    expect(sw).toContain("networkFirstNavigation");
    expect(sw).toContain('caches.match("/offline")');
    expect(sw).not.toMatch(/cache\.put\([^)]*\/api\//);
  });

  it("precache't alleen de offlinelijn en iconen", () => {
    expect(sw).toContain('"/offline"');
    expect(sw).toContain('"/icons/icon-192.png"');
    expect(sw).toContain("self.skipWaiting()");
    expect(sw).toContain("self.clients.claim()");
  });

  it("laat /sw.js, /offline en het manifest publiek", () => {
    expect(proxy).toContain('pathname === "/offline"');
    expect(proxy).toContain('pathname === "/sw.js"');
    expect(proxy).toContain('pathname === "/manifest.webmanifest"');
    expect(proxy).toContain("sw.js|manifest.webmanifest");
  });

  it("registreert de worker in de root layout en toont installatie in instellingen", () => {
    expect(layout).toContain("PwaRegister");
    expect(layout).toContain("appleWebApp");
    expect(settings).toContain("PwaInstallCard");
  });
});
