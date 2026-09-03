import { describe, expect, it } from "vitest";
import { excludePinnedModules } from "@/lib/ui/sidebarPin";
import type { ModuleId } from "@/types";

describe("excludePinnedModules", () => {
  const items = [
    { id: "spellcheck" as ModuleId },
    { id: "timing-check" as ModuleId },
    { id: "alignment" as ModuleId },
  ];

  it("laat alles staan als niets gepind is", () => {
    expect(excludePinnedModules(items, [])).toEqual(items);
  });

  it("haalt gepinde tools uit hun oorspronkelijke lijst", () => {
    expect(excludePinnedModules(items, ["timing-check"])).toEqual([
      { id: "spellcheck" },
      { id: "alignment" },
    ]);
  });
});
