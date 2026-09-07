import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const provider = readFileSync(
  new URL("./posthog-provider.tsx", import.meta.url),
  "utf8",
);
const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
const envExample = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");

describe("PostHog EU Cloud", () => {
  it("initialiseert alleen met een project key via de EU host", () => {
    expect(provider).toContain('"use client"');
    expect(provider).toContain("from \"posthog-js\"");
    expect(provider).toContain("from \"posthog-js/react\"");
    expect(provider).toContain("process.env.NEXT_PUBLIC_POSTHOG_KEY");
    expect(provider).toContain("https://eu.posthog.com");
    expect(provider).toContain('person_profiles: "identified_only"');
    expect(provider).toContain("capture_pageview: false");
    expect(provider).toContain("disable_session_recording: true");
    expect(provider).toContain("mask_all_text: true");
    expect(provider).toContain("maskTextSelector: \"*\"");
    expect(provider).toContain("export function resetPostHogIdentity");
  });

  it("wrapt de root layout en documenteert de env vars", () => {
    expect(layout).toContain("PostHogProvider");
    expect(layout).toContain("@/components/providers/posthog-provider");
    expect(envExample).toContain("NEXT_PUBLIC_POSTHOG_KEY=");
    expect(envExample).toContain("NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com");
  });
});
