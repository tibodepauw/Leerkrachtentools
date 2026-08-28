"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LessonGoal } from "@/types";

export function LessonGoalSelector({
  id,
  label,
  goals,
  selectedId,
  onSelect,
  text,
  onTextChange,
  rows = 8,
  placeholder,
}: {
  id: string;
  label: string;
  goals: LessonGoal[];
  selectedId: LessonGoal["id"];
  onSelect: (id: LessonGoal["id"]) => void;
  text: string;
  onTextChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const filledCount = goals.filter((goal) => goal.text.trim()).length;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex flex-wrap gap-2">
          {goals.map((goal) => (
            <Button
              key={goal.id}
              type="button"
              size="sm"
              variant={selectedId === goal.id ? "default" : "outline"}
              onClick={() => onSelect(goal.id)}
            >
              {goal.id}
              {goal.text.trim() ? "" : " · leeg"}
            </Button>
          ))}
        </div>
        {filledCount > 0 ? (
          <p className="text-xs text-neutral-500">
            {filledCount} van {goals.length} doelen ingevuld via handleiding of
            Actieve les.
          </p>
        ) : (
          <p className="text-xs text-neutral-500">
            Upload eerst een handleiding of vul doelen in via Actieve les.
          </p>
        )}
      </div>
      <Textarea
        id={id}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
    </div>
  );
}
