import { describe, expect, it } from "vitest";
import {
  buildGoalsFromPublisher,
  filledGoals,
  goalIdForIndex,
  trimTrailingEmptyGoals,
} from "@/lib/goals/lessonGoals";

describe("lessonGoals", () => {
  it("start zonder lege slots wanneer er geen extractie is", () => {
    expect(buildGoalsFromPublisher([])).toEqual([]);
  });

  it("volgt het exacte aantal geëxtraheerde doelen", () => {
    expect(buildGoalsFromPublisher(["Enkel doel"]).map((goal) => goal.id)).toEqual([
      "D1",
    ]);
    expect(
      buildGoalsFromPublisher(["Eén", "Twee"]).map((goal) => goal.id),
    ).toEqual(["D1", "D2"]);
  });

  it("zet alle geëxtraheerde doelen om naar D-slots", () => {
    const goals = buildGoalsFromPublisher([
      "Doel één",
      "Doel twee",
      "Doel drie",
      "Doel vier",
      "Doel vijf",
    ]);

    expect(goals).toHaveLength(5);
    expect(goals.map((goal) => goal.text)).toEqual([
      "Doel één",
      "Doel twee",
      "Doel drie",
      "Doel vier",
      "Doel vijf",
    ]);
    expect(goalIdForIndex(4)).toBe("D5");
  });

  it("beperkt tot twaalf doelen", () => {
    const publisherGoals = Array.from(
      { length: 15 },
      (_, index) => `Doel ${index + 1}`,
    );

    expect(buildGoalsFromPublisher(publisherGoals)).toHaveLength(12);
  });

  it("filtert lege doelen uit zichtbare lijst", () => {
    expect(
      filledGoals([
        { id: "D1", text: "Doel één" },
        { id: "D2", text: "   " },
        { id: "D3", text: "Doel drie" },
      ]),
    ).toHaveLength(2);
  });

  it("verwijdert lege slots aan het einde", () => {
    expect(
      trimTrailingEmptyGoals([
        { id: "D1", text: "Doel één" },
        { id: "D2", text: "" },
        { id: "D3", text: "  " },
      ]),
    ).toEqual([{ id: "D1", text: "Doel één" }]);
  });
});
