"use client";

import { useEffect } from "react";
import { shouldRegisterServiceWorker } from "@/lib/pwa/installState";

export function PwaRegister() {
  useEffect(() => {
    if (
      !shouldRegisterServiceWorker(
        process.env.NODE_ENV,
        "serviceWorker" in navigator,
      )
    ) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  }, []);

  return null;
}
