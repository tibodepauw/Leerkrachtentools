"use client";

import { ANALYTICS_POLICY_VERSION } from "./config";
export { ANALYTICS_POLICY_VERSION } from "./config";
export const ANALYTICS_CHOICE_KEY = "leerkrachtentools-analytics-choice";
export const ANALYTICS_CHANGE_EVENT = "lt-analytics-choice";
export type AnalyticsChoice = "accepted" | "rejected" | "unknown";
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
import { analyticsConfiguration } from "./config";
export { analyticsConfiguration } from "./config";

type StoredChoice = { choice: "accepted" | "rejected"; version: string; at: number; expiresAt: number; configuration: string };
let memory: StoredChoice | null = null;
export function readAnalyticsChoice(now = Date.now()): AnalyticsChoice {
  if (typeof window === "undefined") return "unknown";
  try { const stored = window.localStorage.getItem(ANALYTICS_CHOICE_KEY); try { memory = stored ? JSON.parse(stored) : null; } catch { memory = null; } } catch { /* Temporary choice only if storage is blocked. */ }
  if (!memory || memory.version !== ANALYTICS_POLICY_VERSION || memory.configuration !== analyticsConfiguration().fingerprint || !Number.isFinite(memory.expiresAt) || !Number.isFinite(memory.at) || memory.at > now || memory.expiresAt <= now || memory.expiresAt > memory.at + MAX_AGE) return "unknown";
  return memory.choice === "accepted" || memory.choice === "rejected" ? memory.choice : "unknown";
}
export function setAnalyticsChoice(choice: AnalyticsChoice) {
  stopAnalytics();
  memory = choice === "unknown" ? null : { choice, version: ANALYTICS_POLICY_VERSION, at: Date.now(), expiresAt: Date.now() + MAX_AGE, configuration: analyticsConfiguration().fingerprint };
  try { if (memory) window.localStorage.setItem(ANALYTICS_CHOICE_KEY, JSON.stringify(memory)); else window.localStorage.removeItem(ANALYTICS_CHOICE_KEY); } catch { /* In-memory choice only. */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ANALYTICS_CHANGE_EVENT));
}
let anonymousId: string | null = null;
const requests = new Set<AbortController>();
export function stopAnalytics() { for (const controller of requests) controller.abort(); requests.clear(); anonymousId = null; }
export const ANALYTICS_MODULES = new Set(["manual-scanner", "goal-optimizer", "goal-taxonomy", "curriculum-rag", "minimum-goals", "dialogue-formatter", "spellcheck", "timing-check", "alignment", "engagement", "full-audit", "voice-reflection", "active-lesson"]);
const PAGES = new Set(["/", "/settings", "/privacy", "/voorwaarden", "/juridisch", "/offline"]);
export function analyticsProperties(event: string, value: string): Record<string, string | boolean> | null {
  if (event === "$pageview" && PAGES.has(value)) return { $pathname: value, $process_person_profile: false, $geoip_disable: true };
  if (["feature_started", "feature_completed", "feature_failed"].includes(event) && ANALYTICS_MODULES.has(value)) return { feature: value, $process_person_profile: false, $geoip_disable: true };
  return null;
}
/** Explicit PostHog Capture API, no SDK auto-events, queue, retries, beacon or persisted identity. */
export function captureAnalytics(event: string, value: string) {
  const config = analyticsConfiguration();
  if (!config.ready || typeof window === "undefined" || readAnalyticsChoice() !== "accepted") return;
  const properties = analyticsProperties(event, value);
  if (!properties || requests.size >= 4) return;
  anonymousId ??= crypto.randomUUID();
  const controller = new AbortController(); requests.add(controller);
  void fetch(`${config.host}/i/v0/e/`, {
    method: "POST", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", keepalive: false,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: config.key, distinct_id: anonymousId, event, properties }),
    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
  }).then(response => response.body?.cancel()).catch(() => {}).finally(() => requests.delete(controller));
}
export function clearLegacyAnalyticsStorage() {
  if (typeof window === "undefined") return;
  const token = analyticsConfiguration().key;
  if (!token) return;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try { const storage = window[name]; storage.removeItem(`ph_${token}_posthog`); storage.removeItem(`__ph_opt_in_out_${token}`); } catch { /* No analytics dependency on browser storage. */ }
  }
}
