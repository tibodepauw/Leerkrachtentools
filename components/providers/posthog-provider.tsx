"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false,
      session_recording: {
        maskAllInputs: true,
      },
    });
  }, []);

  if (!POSTHOG_KEY) {
    return children;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
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
