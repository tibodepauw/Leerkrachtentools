import { afterEach, expect, it, vi } from "vitest";
import { runDocumentJob } from "./parserWorker";
afterEach(() => vi.unstubAllEnvs());
it("refuses public production parsing without the sandbox and ignores a local bypass flag", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ORIGIN", "https://tools.example.be");
  vi.stubEnv("DOCUMENT_WORKER_SOCKET", "");
  vi.stubEnv("ALLOW_LOCAL_DOCUMENT_WORKER", "true");
  await expect(runDocumentJob({ operation: "extract", bytes: "eA==", fileName: "test.txt" })).rejects.toThrow("niet geconfigureerd");
});
it("never falls back to parsing locally when the configured service is unavailable", async () => {
  vi.stubEnv("DOCUMENT_WORKER_SOCKET", process.platform === "win32" ? "\\\\.\\pipe\\missing-lt-audit-parser" : "/tmp/missing-lt-audit-parser.sock");
  await expect(runDocumentJob({ operation: "extract", bytes: "eA==", fileName: "test.txt" })).rejects.toThrow("niet beschikbaar");
});
