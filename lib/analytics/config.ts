export const ANALYTICS_POLICY_VERSION = "2026-09-19";
export function analyticsConfiguration() {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
  const retentionDays = Number(process.env.NEXT_PUBLIC_POSTHOG_RETENTION_DAYS);
  const region = process.env.NEXT_PUBLIC_POSTHOG_REGION;
  const validHost = region === "EU" ? ["https://eu.i.posthog.com", "https://eu.posthog.com"].includes(host) : region === "US" && ["https://us.i.posthog.com", "https://us.posthog.com"].includes(host);
  return { host, key, retentionDays, region,
    ready: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" && process.env.NEXT_PUBLIC_POSTHOG_CONFIGURATION_CONFIRMED === "true" && !!key && validHost && Number.isSafeInteger(retentionDays) && retentionDays > 0,
    fingerprint: `${ANALYTICS_POLICY_VERSION}:${host}:${region}:${retentionDays}:${key}`,
  };
}