"use client";

import {
  useLayoutEffect,
  useRef,
  type ChangeEvent,
} from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { filledGoals, MAX_LESSON_GOALS } from "@/lib/goals/lessonGoals";
import { cn } from "@/lib/utils";
import type { LessonGoal } from "@/types";

const GOAL_TEXTAREA_MIN_HEIGHT_PX = 56;
const GOAL_TEXTAREA_MAX_HEIGHT_PX = 256;

function syncGoalTextareaHeight(element: HTMLTextAreaElement) {
  element.style.height = `${GOAL_TEXTAREA_MIN_HEIGHT_PX}px`;
  const nextHeight = Math.min(
    GOAL_TEXTAREA_MAX_HEIGHT_PX,
    Math.max(GOAL_TEXTAREA_MIN_HEIGHT_PX, element.scrollHeight),
  );
  if (nextHeight > element.clientHeight) {
    element.style.height = `${nextHeight}px`;
  }
}

export function LessonGoalSelector({
  id,
  label,
  goals,
  selectedId,
  onSelect,
  text,
  onTextChange,
  onAddGoal,
  placeholder,
  minHeightClassName = "min-h-[56px]",
  maxHeightClassName = "max-h-64",
}: {
  id: string;
  label: string;
  goals: LessonGoal[];
  selectedId: LessonGoal["id"];
  onSelect: (id: LessonGoal["id"]) => void;
  text: string;
  onTextChange: (value: string) => void;
  onAddGoal?: () => void;
  placeholder?: string;
  minHeightClassName?: string;
  maxHeightClassName?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const visibleGoals = filledGoals(goals);
  const canAddGoal = goals.length < MAX_LESSON_GOALS;

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (element) {
      syncGoalTextareaHeight(element);
    }
  }, [text, selectedId]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onTextChange(event.target.value);
    syncGoalTextareaHeight(event.target);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex flex-wrap items-center gap-2">
          {visibleGoals.map((goal) => (
            <Button
              key={goal.id}
              type="button"
              size="sm"
              variant={selectedId === goal.id ? "default" : "outline"}
              onClick={() => onSelect(goal.id)}
            >
              {goal.id}
              {goal.taxonomy ? ` · ${goal.taxonomy}` : null}
            </Button>
          ))}
          {onAddGoal && canAddGoal ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onAddGoal}
              aria-label="Doel toevoegen"
              title="Doel toevoegen"
            >
              <Plus className="size-4" />
            </Button>
          ) : null}
        </div>
        {visibleGoals.length === 0 ? (
          <p className="text-xs text-neutral-500">
            Nog geen doelen. Voeg er een toe met + of upload een handleiding.
          </p>
        ) : null}
      </div>
      <div className="overflow-visible">
        <Textarea
          ref={textareaRef}
          id={id}
          rows={2}
          value={text}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            "field-sizing-fixed min-h-[56px] w-full resize-y overflow-y-auto px-2.5 py-1.5 text-sm leading-5",
            minHeightClassName,
            maxHeightClassName,
          )}
          style={{
            minHeight: GOAL_TEXTAREA_MIN_HEIGHT_PX,
            maxHeight: GOAL_TEXTAREA_MAX_HEIGHT_PX,
          }}
        />
      </div>
    </div>
  );
}
