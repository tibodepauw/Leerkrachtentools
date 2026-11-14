import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLessonStore, resetLessonStoreState } from "@/stores/useLessonStore";
import { setActiveUserId } from "@/lib/storage/userStorageScope";
import { syncPreparationTextFromDocument } from "./syncPreparationTextFromDocument";
import { importPreparationDocumentFromFile, syncPreparationDocumentFromFile } from "./syncPreparationDocument";
import { saveLessonDocument } from "./documentStorage";

vi.mock("./documentStorage", () => ({
  getLessonDocument: async () => new Blob(["synthetic"]),
  saveLessonDocument: vi.fn(), deleteLessonDocument: vi.fn(async () => {}),
}));
beforeEach(() => vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() } }));
afterEach(() => { setActiveUserId(null); resetLessonStoreState(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it.each(["edit", "clear", "replace"])("never overwrites work after %s during automatic extraction", async (action) => {
  setActiveUserId("synthetic");
  const document = { id: `old-${action}`, fileName: "lesson.txt", mimeType: "text/plain", uploadedAt: "synthetic" };
  useLessonStore.getState().setPreparationDocument(document);
  let finish!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  const pending = syncPreparationTextFromDocument(document);
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
  if (action === "edit") useLessonStore.getState().syncPreparation("Handmatig verbeterd");
  if (action === "clear") useLessonStore.getState().clearSession();
  if (action === "replace") useLessonStore.getState().setPreparationDocument({ ...document, id: "new" });
  const expected = useLessonStore.getState().lesson.lessonPreparation;
  finish(Response.json({ text: "Verouderde extractie" }));
  expect(await pending).toBeNull();
  expect(useLessonStore.getState().lesson.lessonPreparation).toBe(expected);
});

it("preserves the last usable document and lesson when an upload is rejected", async () => {
  setActiveUserId("synthetic");
  const document = { id: "good", fileName: "good.docx", mimeType: "application/octet-stream", uploadedAt: "synthetic" };
  useLessonStore.getState().setPreparationDocument(document);
  useLessonStore.getState().syncPreparation("Bestaande les");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Ongeldig document" }, { status: 400 })));
  await expect(importPreparationDocumentFromFile(new File(["broken"], "broken.docx"))).rejects.toThrow("Ongeldig document");
  expect(useLessonStore.getState().lesson.preparationDocument).toEqual(document);
  expect(useLessonStore.getState().lesson.lessonPreparation).toBe("Bestaande les");
  expect(saveLessonDocument).not.toHaveBeenCalled();
});

it("does not replace work edited while a valid upload is being stored", async () => {
  setActiveUserId("synthetic");
  let finish!: () => void;
  vi.mocked(saveLessonDocument).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = syncPreparationDocumentFromFile(new File(["valid"], "new.txt"));
  useLessonStore.getState().syncPreparation("Nieuw werk");
  finish();
  await expect(pending).rejects.toThrow("intussen gewijzigd");
  expect(useLessonStore.getState().lesson.preparationDocument).toBeFalsy();
  expect(useLessonStore.getState().lesson.lessonPreparation).toBe("Nieuw werk");
});
