"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { sanitizeAnalyticsEvent } from "@/lib/analytics/privacy";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/**
 * Product analytics is optional and separate from marketing consent.
 * Session replay stays off: this app shows leerling- and lesinhoud in the DOM.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com",
      person_profiles: "identified_only",
      // The SDK can persist properties before before_send removes them.
      // Keep analytics state in memory, including on shared devices.
      disable_persistence: true,
      save_referrer: false,
      save_campaign_params: false,
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_performance: false,
      capture_exceptions: false,
      disable_surveys: true,
      advanced_disable_flags: true,
      disable_external_dependency_loading: true,
      before_send: sanitizeAnalyticsEvent,
      disable_session_recording: true,
      mask_all_text: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
      },
    });
    setReady(true);
  }, []);

  if (!POSTHOG_KEY) {
    return children;
  }

  return (
    <PHProvider client={posthog}>
      {ready && <PostHogPageView />}
      {children}
    </PHProvider>
  );
}

export function resetPostHogIdentity() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

function PostHogPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (!POSTHOG_KEY || !pathname) return;
    posthog.capture("$pageview", {
      $current_url: window.origin + pathname,
    });
  }, [pathname]);

  return null;
}
