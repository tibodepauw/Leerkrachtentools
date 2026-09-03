import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DelayedIndicator,
  SEARCH_INDICATOR_DELAY_MS,
  SEARCH_INDICATOR_MIN_VISIBLE_MS,
} from "@/lib/ui/delayedIndicator";

describe("DelayedIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("toont niets als het werk binnen 250 ms klaar is", () => {
    const onChange = vi.fn();
    const indicator = new DelayedIndicator(onChange);
    indicator.setActive(true);
    vi.advanceTimersByTime(SEARCH_INDICATOR_DELAY_MS - 1);
    indicator.setActive(false);
    vi.advanceTimersByTime(SEARCH_INDICATOR_DELAY_MS);
    expect(onChange).not.toHaveBeenCalled();
    expect(indicator.visible).toBe(false);
    indicator.dispose();
  });

  it("toont de indicator na 250 ms", () => {
    const onChange = vi.fn();
    const indicator = new DelayedIndicator(onChange);
    indicator.setActive(true);
    vi.advanceTimersByTime(SEARCH_INDICATOR_DELAY_MS);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(indicator.visible).toBe(true);
    indicator.dispose();
  });

  it("houdt de indicator minstens 400 ms zichtbaar", () => {
    const onChange = vi.fn();
    const indicator = new DelayedIndicator(onChange);
    indicator.setActive(true);
    vi.advanceTimersByTime(SEARCH_INDICATOR_DELAY_MS);
    indicator.setActive(false);
    vi.advanceTimersByTime(SEARCH_INDICATOR_MIN_VISIBLE_MS - 1);
    expect(indicator.visible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(indicator.visible).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(false);
    indicator.dispose();
  });

  it("kort de resttijd in als de spinner al zichtbaar was", () => {
    const onChange = vi.fn();
    const indicator = new DelayedIndicator(onChange);
    indicator.setActive(true);
    vi.advanceTimersByTime(SEARCH_INDICATOR_DELAY_MS);
    vi.advanceTimersByTime(300);
    indicator.setActive(false);
    vi.advanceTimersByTime(99);
    expect(indicator.visible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(indicator.visible).toBe(false);
    indicator.dispose();
  });
});
