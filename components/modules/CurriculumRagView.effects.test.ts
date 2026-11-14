import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { beforeEach, describe, expect, it } from "vitest";
import { resetLessonStoreState, useLessonStore } from "@/stores/useLessonStore";
import { preferenceToFilter } from "@/lib/lesson/educationLevelPreference";
import { secondaryGradeFilterFromLessonGrade } from "@/lib/lesson/secondaryFilters";

// Execute the actual mount-effect callbacks without a browser or a DOM shim.
// Selectors and state setters use the real store so filter-reset side effects remain visible.
const source = ts.createSourceFile(
  "CurriculumRagView.tsx",
  readFileSync("components/modules/CurriculumRagView.tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const searchComponent = source.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === "CurriculumSearch",
)!;
const mountEffects = searchComponent.body!.statements.flatMap((node) => {
  if (!ts.isExpressionStatement(node) || !ts.isCallExpression(node.expression)) return [];
  const call = node.expression;
  return call.expression.getText(source) === "useEffect" ? [call.arguments[0].getText(source)] : [];
});

function mountSearchEffects() {
  const state = useLessonStore.getState();
  for (const effect of mountEffects) {
    runInNewContext(`(${effect})()`, {
      ...state,
      educationLevelFilter: preferenceToFilter(state.educationLevel),
      secondaryGradeFilterFromLessonGrade,
      networkOptionsForLevel: () => [{ value: "ALL" }],
    });
  }
}

describe("Curriculumzoekscherm opnieuw openen", () => {
  beforeEach(() => resetLessonStoreState());

  it.each(["buso", "dko", "basisonderwijs"] as const)("behoudt expliciet gekozen niveau %s bij een secundaire actieve les", (level) => {
    useLessonStore.getState().setTargetGroupSelection({ grade: "s3" });
    expect(useLessonStore.getState().educationLevel).toBe("secundair_onderwijs");
    useLessonStore.getState().setEducationLevel(level);
    useLessonStore.getState().setDomainDetailFilter(level === "buso" ? "ov2" : "all");

    mountSearchEffects();

    expect(useLessonStore.getState().educationLevel).toBe(level);
    expect(useLessonStore.getState().domainDetailFilter).toBe(level === "buso" ? "ov2" : "all");
  });

  it("behoudt een apart gekozen graadfilter bij opnieuw openen", () => {
    useLessonStore.getState().setTargetGroupSelection({ grade: "s3" });
    useLessonStore.getState().setSecondaryGradeFilter("1ste_graad");
    mountSearchEffects();
    expect(useLessonStore.getState().secondaryGradeFilter).toBe("1ste_graad");
  });
});
