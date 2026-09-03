"use client";

import { useEffect, useRef, useState } from "react";
import { DelayedIndicator } from "@/lib/ui/delayedIndicator";

export function useDelayedIndicator(active: boolean) {
  const [visible, setVisible] = useState(false);
  const indicatorRef = useRef<DelayedIndicator | null>(null);

  useEffect(() => {
    const indicator = new DelayedIndicator(setVisible);
    indicatorRef.current = indicator;
    return () => {
      indicator.dispose();
      if (indicatorRef.current === indicator) {
        indicatorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    indicatorRef.current?.setActive(active);
  }, [active]);

  return visible;
}
