"use client";

import { useState } from "react";
import { Loader2, Target } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonStore } from "@/stores/useLessonStore";

type Coverage = "gedekt" | "gedeeltelijk" | "ontbreekt";
interface AlignmentResult {
  rows: Array<{
    goal: string;
    instruction: Coverage;
    practice: Coverage;
    evaluation: Coverage;
    advice: string;
  }>;
}

function CoverageBadge({ value }: { value: Coverage }) {
  return (
    <Badge variant={value === "gedekt" ? "default" : "outline"} className={value === "ontbreekt" ? "border-red-800 text-red-300" : value === "gedeeltelijk" ? "border-orange-700 text-orange-300" : "bg-emerald-700"}>
      {value}
    </Badge>
  );
}

export function AlignmentAuditView() {
  const lesson = useLessonStore((state) => state.lesson);
  const syncPreparation = useLessonStore((state) => state.syncPreparation);
  const [content, setContent] = useState(lesson.lessonPreparation);
  const { analyze, result, loading, error } = useAnalysis<AlignmentResult>();
  const goals = lesson.goals.map((goal) => `${goal.id}: ${goal.text}`);

  return (
    <ModuleShell
      eyebrow="Kwaliteitscontrole"
      title="Doel-activiteit alignering"
      description="Controleert per D-doel uitleg, zelfstandige oefening en evaluatie."
      input={
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-800 p-4 text-sm">
            {goals.map((goal) => <p key={goal} className="mb-2 last:mb-0">{goal}</p>)}
          </div>
          <Label htmlFor="alignment-content">Lesopbouw</Label>
          <Textarea id="alignment-content" rows={18} value={content} onChange={(event) => setContent(event.target.value)} />
          <Button variant="outline" onClick={() => syncPreparation(content)}>Sync invoer naar sessie</Button>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button disabled={loading || !content.trim()} onClick={() => analyze("/api/audit-alignment", { goals: lesson.goals.map((goal) => goal.text), content })}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Target className="size-4" />}
            Controleer alignering
          </Button>
        </div>
      }
      output={
        result ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-neutral-800">
              <Table>
                <TableHeader><TableRow><TableHead>Doel</TableHead><TableHead>Instructie</TableHead><TableHead>Verwerking</TableHead><TableHead>Afronding</TableHead></TableRow></TableHeader>
                <TableBody>
                  {result.data.rows.map((row) => (
                    <TableRow key={row.goal}>
                      <TableCell className="max-w-48 text-xs">{row.goal}</TableCell>
                      <TableCell><CoverageBadge value={row.instruction} /></TableCell>
                      <TableCell><CoverageBadge value={row.practice} /></TableCell>
                      <TableCell><CoverageBadge value={row.evaluation} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {result.data.rows.map((row) => (
              <div key={`${row.goal}-advice`} className="flex items-start justify-between gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
                <p>{row.advice}</p><CopyButton value={row.advice} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyOutput>De constructive-alignmentmatrix verschijnt hier.</EmptyOutput>
        )
      }
    />
  );
}
