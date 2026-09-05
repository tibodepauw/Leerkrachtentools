import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MOBILE_WIDTH,
  SIDEBAR_WORDMARK_MIN_WIDTH,
  sidebarShowsWordmark,
} from "@/hooks/useSidebarLayout";

describe("sidebarShowsWordmark", () => {
  it("verbergt de wordmark onder de minimale breedte", () => {
    expect(sidebarShowsWordmark(SIDEBAR_MIN_WIDTH)).toBe(false);
    expect(sidebarShowsWordmark(SIDEBAR_WORDMARK_MIN_WIDTH - 1)).toBe(false);
  });

  it("toont de wordmark vanaf de drempel en op het default- en mobiele formaat", () => {
    expect(sidebarShowsWordmark(SIDEBAR_WORDMARK_MIN_WIDTH)).toBe(true);
    expect(sidebarShowsWordmark(SIDEBAR_DEFAULT_WIDTH)).toBe(true);
    expect(sidebarShowsWordmark(SIDEBAR_MOBILE_WIDTH)).toBe(true);
  });

  it("verbergt de wordmark in de ingevouwen zijbalk", () => {
    expect(sidebarShowsWordmark(SIDEBAR_DEFAULT_WIDTH, true)).toBe(false);
  });
});

describe("sidebar wordmark markup", () => {
  it("koppelt de wordmark aan de breedtedrempel", () => {
    const sidebar = readFileSync("components/layout/Sidebar.tsx", "utf8");
    expect(sidebar).toContain("sidebarShowsWordmark(width, collapsed)");
    expect(sidebar).toContain("{showWordmark ? (");
    expect(sidebar).toContain("<LtMark className=\"mr-auto\" />");
    expect(sidebar).not.toContain("/icons/icon.svg");
    expect(sidebar).toContain("width={SIDEBAR_MOBILE_WIDTH}");
  });
});
