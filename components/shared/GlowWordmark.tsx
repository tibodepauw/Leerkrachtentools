"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export const GLOW_WORDMARK_TEXT = "Leerkrachtentools";

const VIEW_WIDTH = 1720;
const VIEW_HEIGHT = 380;
const CROP_HEIGHT = 260;

export function GlowWordmark({ className }: { className?: string }) {
  const reactId = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<SVGCircleElement>(null);
  const ambientRef = useRef<HTMLDivElement>(null);

  const mouseLightId = `glow-mouse-${reactId}`;
  const maskId = `glow-mask-${reactId}`;
  const strokeGlowId = `glow-stroke-${reactId}`;
  const staticShineId = `glow-shine-${reactId}`;

  useEffect(() => {
    const root = rootRef.current;
    const mask = maskRef.current;
    const ambient = ambientRef.current;
    if (!root || !mask || !ambient) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const applyGlow = (x: number, y: number, rect: DOMRect) => {
      if (rect.width <= 0 || rect.height <= 0) return;
      mask.setAttribute("cx", String((x / rect.width) * VIEW_WIDTH));
      mask.setAttribute("cy", String((y / rect.height) * CROP_HEIGHT));
      ambient.style.left = `${x}px`;
      ambient.style.top = `${y}px`;
      ambient.style.opacity = "1";
    };

    const hideGlow = () => {
      mask.setAttribute("cx", "-500");
      mask.setAttribute("cy", "-500");
      ambient.style.opacity = "0";
    };

    const onMove = (clientX: number, clientY: number) => {
      const rect = root.getBoundingClientRect();
      applyGlow(clientX - rect.left, clientY - rect.top, rect);
    };

    const onMouseMove = (event: MouseEvent) => onMove(event.clientX, event.clientY);
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      onMove(touch.clientX, touch.clientY);
    };

    root.addEventListener("mousemove", onMouseMove);
    root.addEventListener("touchmove", onTouchMove, { passive: true });
    root.addEventListener("mouseleave", hideGlow);

    return () => {
      root.removeEventListener("mousemove", onMouseMove);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("mouseleave", hideGlow);
      hideGlow();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn("glow-wordmark", className)}
      aria-hidden="true"
    >
      <div ref={ambientRef} className="glow-wordmark__ambient" />
      <svg
        className="glow-wordmark__svg"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMin slice"
      >
        <defs>
          <radialGradient id={mouseLightId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <mask id={maskId}>
            <circle
              ref={maskRef}
              cx="-500"
              cy="-500"
              r="180"
              fill={`url(#${mouseLightId})`}
            />
          </mask>
          <linearGradient id={strokeGlowId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id={staticShineId} x1="0%" y1="0%" x2="45%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="25%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          className="glow-wordmark__base"
        >
          {GLOW_WORDMARK_TEXT}
        </text>
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          className="glow-wordmark__shine"
          stroke={`url(#${staticShineId})`}
        >
          {GLOW_WORDMARK_TEXT}
        </text>
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          className="glow-wordmark__glow"
          stroke={`url(#${strokeGlowId})`}
          mask={`url(#${maskId})`}
        >
          {GLOW_WORDMARK_TEXT}
        </text>
      </svg>
    </div>
  );
}
