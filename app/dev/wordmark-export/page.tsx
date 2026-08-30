"use client";

import { useEffect, useState } from "react";
import { WordmarkLoader } from "@/components/shared/WordmarkLoader";

/** Minimal black canvas for README banner GIF/PNG export scripts. */
export default function WordmarkExportPage() {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setKey((value) => value + 1), 2200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      id="wordmark-export"
      className="flex h-[360px] w-[1200px] items-center justify-center bg-black"
    >
      <WordmarkLoader key={key} variant="gather" />
    </div>
  );
}
