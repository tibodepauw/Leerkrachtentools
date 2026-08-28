import { describe, expect, it } from "vitest";
import {
  hasActiveLessonContext,
  hasLessonPreparation,
  needsPreparationTextSync,
  shouldSyncScannerSourceToPreparation,
} from "@/lib/lesson/preparationText";
import { createEmptyGoals } from "@/lib/goals/lessonGoals";
import type { ActiveLesson } from "@/types";

function sampleLesson(overrides: Partial<ActiveLesson> = {}): ActiveLesson {
  return {
    topic: "",
    learningArea: "",
    component: "",
    targetGroup: "",
    materials: [],
    rawPublisherGoals: [],
    goals: createEmptyGoals(),
    totalMinutes: 50,
    educationNetwork: "ZILL",
    referenceSchoolYear: "",
    lessonPreparation: "",
    preparationDocument: null,
    phases: [
      { name: "Instap", text: "" },
      { name: "Instructie", text: "" },
      { name: "Verwerking", text: "" },
      { name: "Afronding", text: "" },
    ],
    engagementFactors: [],
    ...overrides,
  };
}

describe("preparationText", () => {
  it("detects active lesson context from topic or goals", () => {
    expect(hasActiveLessonContext(sampleLesson())).toBe(false);
    expect(
      hasActiveLessonContext(sampleLesson({ topic: "creatief schrijven" })),
    ).toBe(true);
    expect(
      hasActiveLessonContext(
        sampleLesson({
          goals: [{ id: "D1", text: "De leerlingen kunnen..." }],
        }),
      ),
    ).toBe(true);
  });

  it("only syncs scanner source when preparation is empty", () => {
    expect(
      shouldSyncScannerSourceToPreparation(
        sampleLesson({ topic: "creatief schrijven" }),
      ),
    ).toBe(true);
    expect(
      shouldSyncScannerSourceToPreparation(
        sampleLesson({
          topic: "creatief schrijven",
          lessonPreparation: "Bestaande tekst",
        }),
      ),
    ).toBe(false);
  });

  it("detects filled preparation text", () => {
    expect(hasLessonPreparation(sampleLesson())).toBe(false);
    expect(
      hasLessonPreparation(sampleLesson({ lessonPreparation: "  fase 1  " })),
    ).toBe(true);
  });

  it("detects when document text still needs syncing", () => {
    expect(needsPreparationTextSync(sampleLesson())).toBe(false);
    expect(
      needsPreparationTextSync(
        sampleLesson({
          preparationDocument: {
            id: "doc-1",
            fileName: "les.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            uploadedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
      ),
    ).toBe(true);
    expect(
      needsPreparationTextSync(
        sampleLesson({
          lessonPreparation: "Fase 1",
          preparationDocument: {
            id: "doc-1",
            fileName: "les.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            uploadedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
      ),
    ).toBe(false);
  });
});
