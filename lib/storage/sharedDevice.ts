"use client";

const KEY = "leerkrachtentools-shared-device";
// Shared computers keep content in this tab's memory only, including previews.
export const temporaryStorage = new Map<string, string>();
export const temporaryDocuments = new Map<string, Blob>();

export function isSharedDevice() {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(KEY) === "true"; }
  catch { return true; }
}

export function setSharedDevice(enabled: boolean) {
  window.localStorage.setItem(KEY, String(enabled));
  clearTemporaryStorage();
}

export function clearTemporaryStorage() {
  temporaryStorage.clear();
  temporaryDocuments.clear();
}
