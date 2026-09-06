import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GoalOptimizerView", () => {
  it("houdt gelijke padding op kaarten zonder extra pt-5", () => {
    const source = readFileSync("components/modules/GoalOptimizerView.tsx", "utf8");
    expect(source).toContain('<CardContent className="space-y-3 text-sm">');
    expect(source).not.toMatch(/CardContent className="[^"]*pt-5/);
  });
});
