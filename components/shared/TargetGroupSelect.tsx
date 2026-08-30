"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRADE_OPTIONS } from "@/lib/lesson/targetGroup";
import type { LessonGrade } from "@/types";

interface TargetGroupSelectProps {
  grade: LessonGrade | "";
  ageRange: string;
  displayTargetGroup: string;
  onChange: (value: {
    grade: LessonGrade | "";
    customLabel?: string;
    customAgeRange?: string;
  }) => void;
  id?: string;
}

export function TargetGroupSelect({
  grade,
  ageRange,
  displayTargetGroup,
  onChange,
  id = "target-group",
}: TargetGroupSelectProps) {
  const customLabel =
    grade === "custom"
      ? displayTargetGroup.replace(/\s*\([^)]*\)\s*$/, "").trim()
      : "";
  const customAgeRange = grade === "custom" ? ageRange : "";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={id}>Doelgroep</Label>
        <Select
          value={grade || undefined}
          onValueChange={(value) =>
            onChange({ grade: value as LessonGrade })
          }
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Kies leerjaar of leeftijd" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Kleuteronderwijs</SelectLabel>
              {GRADE_OPTIONS.filter((option) => option.group === "kleuter").map(
                (option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} ({option.ageRange})
                  </SelectItem>
                ),
              )}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Lager onderwijs</SelectLabel>
              {GRADE_OPTIONS.filter((option) => option.group === "lager").map(
                (option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} ({option.ageRange})
                  </SelectItem>
                ),
              )}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Secundair onderwijs</SelectLabel>
              {GRADE_OPTIONS.filter((option) => option.group === "secundair").map(
                (option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} ({option.ageRange})
                  </SelectItem>
                ),
              )}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Aangepast</SelectLabel>
              <SelectItem value="custom">
                Aangepast / Graadsklas (vrij veld)
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {grade === "custom" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-custom-label`}>Niveau / graadsklas</Label>
            <Input
              id={`${id}-custom-label`}
              value={customLabel}
              placeholder="Bijv. Graadsklas B, L6B"
              onChange={(event) =>
                onChange({
                  grade: "custom",
                  customLabel: event.target.value,
                  customAgeRange,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-custom-age`}>Leeftijd (optioneel)</Label>
            <Input
              id={`${id}-custom-age`}
              value={customAgeRange}
              placeholder="Bijv. 8-9j, 7-9 jaar"
              onChange={(event) =>
                onChange({
                  grade: "custom",
                  customLabel,
                  customAgeRange: event.target.value,
                })
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
