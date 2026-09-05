import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SelectContent", () => {
  it("laat een popper-lijst hoger worden dan het trigger-veld", () => {
    const source = readFileSync("components/ui/select.tsx", "utf8");
    expect(source).toContain(
      "data-[position=popper]:min-h-(--radix-select-trigger-height)",
    );
    expect(source).not.toContain(
      "data-[position=popper]:h-(--radix-select-trigger-height)",
    );
  });
});
