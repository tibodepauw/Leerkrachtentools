"use client";

import type { KeyboardEvent } from "react";
import { Sparkles, Zap } from "lucide-react";
import { Label } from "@/components/ui/label";

export type CurriculumSearchMode = "snel" | "pro";

const OPTIONS: Array<{
  value: CurriculumSearchMode;
  label: string;
  hint: string;
  icon: typeof Zap;
}> = [
  {
    value: "snel",
    label: "Snel",
    hint: "Directe catalogus: toont snel de beste treffers voor een code of trefwoord.",
    icon: Zap,
  },
  {
    value: "pro",
    label: "Pro",
    hint: "Didactische assistent: analyseert je lesactiviteit en stelt 2 of 3 beargumenteerde doelen voor.",
    icon: Sparkles,
  },
];

export function CurriculumSearchModeToggle({
  value,
  onChange,
}: {
  value: CurriculumSearchMode;
  onChange: (value: CurriculumSearchMode) => void;
}) {
  const active = OPTIONS.find((option) => option.value === value) ?? OPTIONS[0];

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    onChange(value === "pro" ? "snel" : "pro");
  }

  return (
    <div className="space-y-2">
      <Label id="leerplandoel-search-mode-label">Zoekmodus</Label>
      <div
        role="radiogroup"
        aria-labelledby="leerplandoel-search-mode-label"
        className="search-mode-toggle"
        data-mode={value}
        onKeyDown={handleKeyDown}
      >
        <span className="search-mode-toggle__thumb" aria-hidden="true" />
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              data-mode={option.value}
              className="search-mode-toggle__option"
              onClick={() => onChange(option.value)}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="search-mode-toggle__label">{option.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-neutral-500">{active.hint}</p>
    </div>
  );
}
