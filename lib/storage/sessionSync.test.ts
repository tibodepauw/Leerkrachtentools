import { afterEach, expect, it, vi } from "vitest";
import { announceSessionChange, SESSION_CHANGE_KEY, subscribeSessionChange } from "./sessionSync";

afterEach(() => vi.unstubAllGlobals());

it("invalidates other tabs via storage events and removes listeners on unmount", () => {
  const target = new EventTarget();
  vi.stubGlobal("window", target);
  vi.stubGlobal("BroadcastChannel", undefined);
  const reset = vi.fn();
  const stop = subscribeSessionChange(reset);
  const change = () => {
    const event = new Event("storage");
    Object.defineProperty(event, "key", { value: SESSION_CHANGE_KEY });
    target.dispatchEvent(event);
  };
  change();
  expect(reset).toHaveBeenCalledTimes(1);
  stop();
  change();
  expect(reset).toHaveBeenCalledTimes(1);
});

it("still broadcasts when browser storage is blocked; contains no identity or content", () => {
  const post = vi.fn();
  const close = vi.fn();
  vi.stubGlobal("window", { localStorage: { setItem: () => { throw new Error("blocked"); } } });
  vi.stubGlobal("BroadcastChannel", class { postMessage = post; close = close; });
  announceSessionChange();
  expect(post).toHaveBeenCalledWith({ type: "session-change", nonce: expect.any(String) });
  expect(close).toHaveBeenCalledOnce();
});
