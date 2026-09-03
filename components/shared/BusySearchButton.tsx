"use client";

import type { ReactNode } from "react";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { useDelayedIndicator } from "@/hooks/useDelayedIndicator";

export function BusySearchButton({
  loading,
  disabled,
  idleLabel,
  busyLabel,
  idleIcon,
  onClick,
}: {
  loading: boolean;
  disabled: boolean;
  idleLabel: string;
  busyLabel: string;
  idleIcon: ReactNode;
  onClick: () => void;
}) {
  const showSpinner = useDelayedIndicator(loading);
  const visualBusy = loading || showSpinner;

  return (
    <span
      className="curriculum-search-action-wrap"
      data-busy={visualBusy ? "true" : undefined}
    >
      <ModuleActionButton
        className="curriculum-search-action"
        disabled={disabled}
        aria-busy={visualBusy}
        aria-live="polite"
        onClick={onClick}
      >
        {showSpinner ? (
          <span className="curriculum-search-spinner" aria-hidden="true" />
        ) : (
          idleIcon
        )}
        {visualBusy ? busyLabel : idleLabel}
      </ModuleActionButton>
    </span>
  );
}
