export const ANALYTICS_POLICY_VERSION = "2026-09-19";
export function analyticsConfiguration() {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
  const retentionMonths = Number(process.env.NEXT_PUBLIC_POSTHOG_RETENTION_MONTHS);
  const region = process.env.NEXT_PUBLIC_POSTHOG_REGION;
  const retentionEnforced = process.env.NEXT_PUBLIC_POSTHOG_RETENTION_ENFORCED === "true";
  const validHost = region === "EU" ? ["https://eu.i.posthog.com", "https://eu.posthog.com"].includes(host) : region === "US" && ["https://us.i.posthog.com", "https://us.posthog.com"].includes(host);
  return { host, key, retentionMonths, retentionEnforced, region,
    ready: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" && process.env.NEXT_PUBLIC_POSTHOG_CONFIGURATION_CONFIRMED === "true" && retentionEnforced && !!key && validHost && Number.isSafeInteger(retentionMonths) && retentionMonths > 0,
    fingerprint: `${ANALYTICS_POLICY_VERSION}:${host}:${region}:${retentionMonths}:${retentionEnforced}:${key}`,
  };
}