import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sync: vi.fn(), save: vi.fn(), setDocument: vi.fn() }));
vi.mock("@/stores/useLessonStore", () => ({ useLessonStore: { getState: () => ({ lesson: { lessonPreparation: "" }, syncPreparation: mocks.sync, setPreparationDocument: mocks.setDocument }) } }));
vi.mock("./documentStorage", () => ({ getLessonDocument: async () => new Blob(["private A"]), saveLessonDocument: mocks.save }));
import { setActiveUserId } from "@/lib/storage/userStorageScope";
import { syncPreparationTextFromDocument } from "./syncPreparationTextFromDocument";
import { syncPreparationDocumentFromFile } from "./syncPreparationDocument";
afterEach(() => { setActiveUserId(null); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("never applies a late import to another account or a new session of the same account", async () => {
  for (const next of ["B", "A"]) {
    setActiveUserId("A");
    let finish!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetcher);
    const task = syncPreparationTextFromDocument({ id: `doc-${next}`, fileName: "A.txt", mimeType: "text/plain", uploadedAt: "synthetic" });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
    setActiveUserId(null);
    setActiveUserId(next);
    finish(Response.json({ text: "private A" }));
    expect(await task).toBeNull();
    expect(mocks.sync).not.toHaveBeenCalled();
  }
});

it("does not publish document metadata after the original session ends", async () => {
  setActiveUserId("A");
  let finish!: () => void;
  mocks.save.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  const task = syncPreparationDocumentFromFile(new File(["private A"], "A.txt"));
  setActiveUserId("B");
  finish();
  await expect(task).rejects.toThrow();
  expect(mocks.setDocument).not.toHaveBeenCalled();
});
