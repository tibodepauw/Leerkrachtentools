import { describe, expect, it } from "vitest";
import {
  isValidRagBody,
  isValidRagTargetContext,
  RAG_BODY_LIMITS,
} from "@/lib/rag/requestValidation";

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

describe("gedeelde RAG-bodyvalidatie", () => {
  const curriculumBody = {
    goal: "Tellen tot 20",
    network: "ZILL",
    educationLevel: "LAGER",
    grade: "l1",
    ageRange: "6-7 jaar",
    secondaryGrade: "all",
    secondaryFinality: "all",
    domainDetail: "all",
    domainFinality: "all",
    enableLlmQueryRewriting: false,
    searchMode: "pro",
    topic: "Fruit",
    learningArea: "Wiskunde",
    phases: [
      { name: "Instap", text: "" },
      { name: "Instructie", text: "Samen tellen" },
      { name: "Verwerking", text: "Werkblad" },
      { name: "Afronding", text: "" },
    ],
  };

  it("accepteert de aanvragen die de zoekmodule verstuurt", () => {
    expect(isValidRagBody(curriculumBody)).toBe(true);

    const { network, ...minimumGoalsBody } = curriculumBody;
    void network;
    expect(isValidRagBody(minimumGoalsBody)).toBe(true);
    expect(isValidRagBody({ ...curriculumBody, searchMode: "snel" })).toBe(true);
  });

  it("accepteert een minimale aanvraag en de alternatieve veldnamen", () => {
    expect(isValidRagBody({ goal: "Tellen" })).toBe(true);
    expect(isValidRagBody({})).toBe(true);
    expect(
      isValidRagBody({ query: "Tellen", curriculum: "go-nieuw", level: "lager", limit: 3 }),
    ).toBe(true);
    expect(isValidRagBody({ goal: "Tellen", network: "GOOUD", grade: "" })).toBe(true);
    expect(isValidRagBody({ goal: "Tellen", educationLevel: "", network: " " })).toBe(true);
    expect(isValidRagBody({ goal: "Tellen", onbekendVeld: { diep: [1] } })).toBe(true);
  });

  it.each([
    ["null", null],
    ["array", []],
    ["tekst", "goal"],
    ["getal", 5],
  ])("weigert een body die geen object is: %s", (_label, body) => {
    expect(isValidRagBody(body)).toBe(false);
  });

  it.each([
    "goal",
    "query",
    "network",
    "curriculum",
    "educationLevel",
    "level",
    "grade",
    "ageRange",
    "secondaryGrade",
    "secondaryFinality",
    "domainDetail",
    "domainFinality",
    "searchMode",
    "topic",
    "learningArea",
  ])("weigert null, array, object, getal en boolean in tekstveld %s", (field) => {
    for (const value of [null, ["l1"], { toString: "x" }, 1, true]) {
      expect(isValidRagBody({ goal: "Tellen", [field]: value })).toBe(false);
    }
  });

  it("weigert ongeldige enumwaarden", () => {
    for (const invalid of [
      { educationLevel: "UNIVERSITEIT" },
      { level: "admin" },
      { network: "PRIVE" },
      { curriculum: "x" },
      { searchMode: "PRO" },
      { searchMode: "turbo" },
      { grade: "l9" },
      { secondaryGrade: "4de_graad" },
      { secondaryFinality: "alles" },
    ]) {
      expect(isValidRagBody({ goal: "Tellen", ...invalid })).toBe(false);
    }
  });

  it("weigert een verkeerd type voor query-herschrijving", () => {
    for (const value of [null, "true", 1, []]) {
      expect(
        isValidRagBody({ goal: "Tellen", enableLlmQueryRewriting: value }),
      ).toBe(false);
    }
  });

  it("weigert verkeerd geneste lesfasen", () => {
    for (const phases of [
      null,
      "Instap",
      { name: "Instap", text: "" },
      [null],
      ["Instap"],
      [[{ name: "Instap", text: "" }]],
      [{ name: "Instap" }],
      [{ name: "Instap", text: null }],
      [{ name: "Instap", text: { diep: "x" } }],
      [{ name: ["Instap"], text: "" }],
      [{ name: 1, text: "" }],
    ]) {
      expect(isValidRagBody({ goal: "Tellen", phases })).toBe(false);
    }
  });

  it("begrenst lengtes en aantallen", () => {
    const tooLong = (limit: number) => "x".repeat(limit + 1);
    const atLimit = (limit: number) => "x".repeat(limit);

    expect(isValidRagBody({ goal: atLimit(RAG_BODY_LIMITS.goal) })).toBe(true);
    expect(isValidRagBody({ goal: tooLong(RAG_BODY_LIMITS.goal) })).toBe(false);
    expect(isValidRagBody({ query: tooLong(RAG_BODY_LIMITS.goal) })).toBe(false);
    expect(isValidRagBody({ topic: atLimit(RAG_BODY_LIMITS.lessonText) })).toBe(true);
    expect(isValidRagBody({ topic: tooLong(RAG_BODY_LIMITS.lessonText) })).toBe(false);
    expect(
      isValidRagBody({ learningArea: tooLong(RAG_BODY_LIMITS.lessonText) }),
    ).toBe(false);
    expect(isValidRagBody({ ageRange: tooLong(RAG_BODY_LIMITS.filter) })).toBe(false);
    expect(
      isValidRagBody({
        phases: [{ name: "Instap", text: tooLong(RAG_BODY_LIMITS.phaseText) }],
      }),
    ).toBe(false);
    expect(
      isValidRagBody({
        phases: [{ name: tooLong(RAG_BODY_LIMITS.phaseName), text: "" }],
      }),
    ).toBe(false);
    expect(
      isValidRagBody({
        phases: Array.from({ length: RAG_BODY_LIMITS.phases + 1 }, () => ({
          name: "Instap",
          text: "",
        })),
      }),
    ).toBe(false);
  });
});
