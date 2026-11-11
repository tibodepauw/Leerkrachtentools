import { expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const locations = name => Object.entries(lock.packages).filter(([location, metadata]) =>
  location.endsWith("/" + name) || metadata.name === name,
).map(([location]) => location);
const honoLocations = locations("hono");
const adapterLocations = locations("@hono/node-server");

if (honoLocations.length === 0) {
  it("keeps the removed Hono server and adapter absent from every lock location", () => {
    expect(honoLocations).toEqual([]);
    expect(adapterLocations).toEqual([]);
  });
} else {
  const { Hono } = await import("hono");
  const { serveStatic } = await import("hono/serve-static");
  const { jsx, Suspense, createContext } = await import("hono/jsx");
  const { renderToString, renderToReadableStream } = await import("hono/jsx/dom/server");
  const serveNodeStatic = adapterLocations.length > 0
    ? (await import("@hono/node-server/serve-static")).serveStatic
    : null;

  if (adapterLocations.length === 0) {
    it("keeps the removed Hono adapter absent from every lock location", () => {
      expect(locations("@hono/node-server")).toEqual([]);
    });
  }

  const input = '<img src=x onerror="alert(1)"> & lesinhoud';
  const escaped = "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; lesinhoud";

  it.each([
    ["Suspense child", () => jsx(Suspense, {}, input).toString()],
    ["Context.Provider child", () => jsx(createContext(null).Provider, { value: null }, input).toString()],
    ["renderToString root", () => renderToString(input)],
    ["renderToReadableStream root", async () => new Response(await renderToReadableStream(input)).text()],
  ])("escapes untrusted strings at the %s boundary (GHSA-hxh3-vqpv-xpqv)", async (_name, render) => {
    expect(String(await render())).toBe(escaped);
    expect(renderToString(jsx("p", {}, "3 < 4 & gewone lesinhoud"))).toBe("<p>3 &lt; 4 &amp; gewone lesinhoud</p>");
  });

  it.each(serveNodeStatic ? ["core", "node adapter"] : ["core"])("protects static prefixes with %s middleware (GHSA-5r4p-p66f-jhc7 / GHSA-rmxm-3fg6-px4f)", async adapter => {
    const root = await mkdtemp(path.join(tmpdir(), "hono-static-regression-"));
    try {
      await mkdir(path.join(root, "private"));
      await writeFile(path.join(root, "private", "secret.txt"), "SYNTHETIC-PRIVATE");
      await writeFile(path.join(root, "lesson.txt"), "SYNTHETIC-PUBLIC");
      const app = new Hono();
      app.use("/private/*", c => c.text("denied", 401));
      app.use("*", adapter === "core" ? serveStatic({
        root: "./",
        getContent: file => ({ "private/secret.txt": "SYNTHETIC-PRIVATE", "lesson.txt": "SYNTHETIC-PUBLIC" })[file] ?? null,
      }) : serveNodeStatic({ root }));

      expect((await app.request("/private/secret.txt")).status).toBe(401);
      // The first decode turns %7%30 into %70; the old static middleware
      // decoded that again to 'p', skipping the /private/* authorization.
      const attack = await app.request("/%7%30rivate/secret.txt");
      expect(attack.status).toBe(404);
      expect(await attack.text()).not.toContain("SYNTHETIC-PRIVATE");
      const normal = await app.request("/lesson.txt");
      expect(normal.status).toBe(200);
      expect(await normal.text()).toBe("SYNTHETIC-PUBLIC");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
