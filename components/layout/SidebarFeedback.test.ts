import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SidebarFeedback", () => {
  it("opent het dialoog via de knop, ook in de ingeklapte zijbalk", () => {
    const source = readFileSync("components/layout/SidebarFeedback.tsx", "utf8");

    expect(source).toContain('onClick={() => setOpen(true)}');
    expect(source).toContain('aria-label="Idee of feedback"');
    expect(source).toContain("TooltipTrigger");
    expect(source).not.toContain("DialogTrigger");
  });
});
