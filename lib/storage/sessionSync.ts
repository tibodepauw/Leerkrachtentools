"use client";

export const SESSION_CHANGE_KEY = "leerkrachtentools-session-change";

export function announceSessionChange() {
  const message = { type: "session-change", nonce: crypto.randomUUID() };
  try { window.localStorage.setItem(SESSION_CHANGE_KEY, JSON.stringify(message)); } catch { /* BroadcastChannel fallback */ }
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(SESSION_CHANGE_KEY);
    channel.postMessage(message);
    channel.close();
  }
}

export function subscribeSessionChange(onChange: () => void) {
  const listener = (event: StorageEvent) => {
    if (event.key === SESSION_CHANGE_KEY || event.key === "leerkrachtentools-shared-device") onChange();
  };
  window.addEventListener("storage", listener);
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SESSION_CHANGE_KEY) : null;
  if (channel) channel.onmessage = onChange;
  return () => {
    window.removeEventListener("storage", listener);
    channel?.close();
  };
}
