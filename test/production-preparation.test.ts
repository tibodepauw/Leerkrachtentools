import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { canonicalProfileImage } from "@/lib/auth/profileImage";
import { apiKeyExpiry, createOrganization, generateApiKey, rotateApiKey, validateApiKey } from "@/lib/api-keys";
import { getDatabase } from "@/lib/db/sqlite";
import { withApiAuth } from "@/lib/api-guard";
import { parseInWorker } from "@/lib/documents/parserWorker";
import { setSharedDevice, clearTemporaryStorage } from "@/lib/storage/sharedDevice";
import { setActiveUserId } from "@/lib/storage/userStorageScope";
import { createUserScopedPersistStorage } from "@/lib/storage/userScopedPersistStorage";
import { saveLessonDocument, getLessonDocument } from "@/lib/documents/documentStorage";

afterEach(() => { vi.unstubAllGlobals(); clearTemporaryStorage(); setActiveUserId(null); });

function smallPdf() {
  const content = "BT /F1 12 Tf 50 100 Td (Een veilige les) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

describe("production preparation", () => {
  it("decodes avatars, strips metadata and limits output dimensions", async () => {
    const original = await sharp({ create: { width: 1000, height: 600, channels: 3, background: "red" } }).withMetadata().png().toBuffer();
    const output = await canonicalProfileImage(original);
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(512);
    expect(metadata.exif).toBeUndefined();
    await expect(canonicalProfileImage(Buffer.from("GIF89a<script>"))).rejects.toThrow();
    const oversized = await sharp({ create: { width: 9000, height: 1, channels: 3, background: "red" } }).png().toBuffer();
    await expect(canonicalProfileImage(oversized)).rejects.toThrow("8192");
  });

  it("rotates without increasing scopes or resetting budget; revoked key cannot replay", async () => {
    const org = createOrganization({ name: "Rotation test", email: `${randomUUID()}@example.test`, tier: "internal", quota: 10 });
    const key = generateApiKey(org.id, "production", ["curriculum:match"]);
    expect(key.expiresAt - key.createdAt).toBeGreaterThan(89 * 86_400_000);
    const handler = vi.fn(async () => Response.json({ value: 1 }));
    const route = withApiAuth(handler, { requiredScope: "curriculum:match" });
    const request = () => new Request("http://localhost/api/v1/curriculum/match", { method: "POST", headers: { authorization: `Bearer ${key.token}`, "idempotency-key": "rotate", "content-type": "application/json" }, body: "{}" });
    expect((await route(request())).status).toBe(200);
    const next = rotateApiKey(key.id, 30);
    expect(next.scopes).toEqual(key.scopes);
    expect(validateApiKey(next.token, "curriculum:match").usedThisMonth).toBe(1);
    expect((await route(request())).status).toBe(401);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(() => validateApiKey(next.token, "curriculum:match", next.expiresAt)).toThrow("verlopen");
    expect(() => apiKeyExpiry(0)).toThrow();
    const events = getDatabase().prepare("SELECT action FROM api_key_events WHERE org_id = ? ORDER BY id").all(org.id);
    expect(events).toEqual([{ action: "issued" }, { action: "issued" }, { action: "revoked" }]);
  });

  it("keeps shared-device lessons and previews in tab memory and isolates accounts", async () => {
    const disk = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => disk.get(key) ?? null, setItem: (key: string, value: string) => disk.set(key, value), removeItem: (key: string) => disk.delete(key) } });
    setSharedDevice(true);
    setActiveUserId("a");
    const store = createUserScopedPersistStorage();
    store.setItem("ignored", "private lesson");
    await saveLessonDocument("preview", new Blob(["private document"]));
    expect([...disk.values()]).toEqual(["true"]);
    expect(store.getItem("ignored")).toBe("private lesson");
    setActiveUserId("b");
    expect(store.getItem("ignored")).toBeNull();
    expect(await getLessonDocument("preview")).toBeNull();
    clearTemporaryStorage();
    setActiveUserId("a");
    expect(store.getItem("ignored")).toBeNull();
    expect(await getLessonDocument("preview")).toBeNull();
  });

  it("rejects malformed documents inside workers and releases their slots", async () => {
    expect(await parseInWorker(smallPdf(), "pdf")).toContain("Een veilige les");
    for (let n = 0; n < 3; n++) {
      await expect(parseInWorker(Buffer.from("%PDF-invalid"), "pdf")).rejects.toThrow("veilig");
    }
    const controller = new AbortController();
    controller.abort();
    await expect(parseInWorker(Buffer.from("x"), "doc", controller.signal)).rejects.toThrow();
    const active = new AbortController();
    const pending = parseInWorker(smallPdf(), "pdf", active.signal);
    active.abort();
    await expect(pending).rejects.toThrow("afgebroken");
    expect(await parseInWorker(smallPdf(), "pdf")).toContain("Een veilige les");
  });
});
