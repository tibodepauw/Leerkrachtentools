import type { CaptureResult } from "posthog-js";

const pages = new Set(["/", "/settings", "/privacy", "/voorwaarden", "/juridisch", "/offline"]);

/** Only explicit page views of static app routes may leave the browser.
 * Drop SDK enrichment, referrers, titles, DOM data, user properties and URL parameters.
 */
export function sanitizeAnalyticsEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event || event.event !== "$pageview") return null;
  let url: URL;
  try { url = new URL(String(event.properties.$current_url)); } catch { return null; }
  if (!pages.has(url.pathname) || !["http:", "https:"].includes(url.protocol)) return null;
  const properties: Record<string, unknown> = {};
  for (const key of ["token", "distinct_id", "$device_id", "$session_id", "$lib", "$lib_version"]) {
    if (typeof event.properties[key] === "string") properties[key] = event.properties[key];
  }
  return {
    event: "$pageview",
    uuid: event.uuid,
    timestamp: event.timestamp,
    properties: { ...properties, $current_url: `${url.origin}${url.pathname}`, $pathname: url.pathname },
  };
}
