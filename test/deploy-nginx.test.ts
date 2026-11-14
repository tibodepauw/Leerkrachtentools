import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const config = readFileSync("deploy/nginx.conf.example", "utf8");
const locations = [...config.matchAll(/location\s+([^{]+)\{([^}]*)\}/gu)].map(([, matcher, body]) => ({ matcher: matcher.trim(), body }));
const proxied = locations.filter(({ body }) => body.includes("proxy_pass"));

it("rate-limits both login steps with the login zone", () => {
  const login = locations.find(({ body }) => body.includes("zone=lt_login"));
  expect(login?.matcher.startsWith("~ ")).toBe(true);
  const pattern = new RegExp(login!.matcher.slice(2), "u");
  expect(pattern.test("/api/auth/request-code")).toBe(true);
  expect(pattern.test("/api/auth/verify-code")).toBe(true);
  expect(pattern.test("/api/auth/session")).toBe(false);
  expect(pattern.test("/api/auth/verify-code/extra")).toBe(false);
});

it("overwrites every client-IP header in each proxied location", () => {
  expect(proxied.length).toBeGreaterThanOrEqual(2);
  for (const { matcher, body } of proxied) {
    for (const directive of [
      "proxy_set_header X-Forwarded-For $remote_addr;",
      "proxy_set_header X-Real-IP $remote_addr;",
      'proxy_set_header Forwarded "";',
      'proxy_set_header X-Vercel-Forwarded-For "";',
    ]) expect(body, `${matcher}: ${directive}`).toContain(directive);
    expect(body, matcher).toContain("proxy_pass http://127.0.0.1:3000;");
    expect(body, matcher).not.toContain("$proxy_add_x_forwarded_for");
  }
});
