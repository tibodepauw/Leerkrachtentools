import { describe, expect, it } from "vitest";
import { buildGoalsFromPublisher, goalIdForIndex } from "@/lib/goals/lessonGoals";

describe("lessonGoals", () => {
  it("maakt minstens drie lege slots aan", () => {
    expect(buildGoalsFromPublisher([])).toEqual([
      { id: "D1", text: "" },
      { id: "D2", text: "" },
      { id: "D3", text: "" },
    ]);
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
});
