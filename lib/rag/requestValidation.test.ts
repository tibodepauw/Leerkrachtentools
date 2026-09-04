import { describe, expect, it } from "vitest";
import { isValidRagTargetContext } from "@/lib/rag/requestValidation";

describe("RAG doelgroepvalidatie", () => {
  it("accepteert bekende filters", () => {
    expect(
      isValidRagTargetContext({
        grade: "l4",
        ageRange: "9-10 jaar",
        secondaryGrade: "all",
        secondaryFinality: "doorstroom",
        domainDetail: "all",
      }),
    ).toBe(true);
  });

  it("weigert onbekende enums en onbegrensde tekst", () => {
    expect(isValidRagTargetContext({ grade: "admin" })).toBe(false);
    expect(
      isValidRagTargetContext({ ageRange: "x".repeat(101) }),
    ).toBe(false);
  });
});
