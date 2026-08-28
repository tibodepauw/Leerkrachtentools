"use client";

import { ClipboardCheck, Loader2 } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LessonPreparationInput } from "@/components/shared/LessonPreparationInput";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonPreparationText } from "@/hooks/useLessonText";

interface FullAuditResult {
  score: number;
  criteria: Array<{
    label: string;
    status: "groen" | "oranje" | "rood";
    finding: string;
    improvement: string;
  }>;
}

export function FullAuditView() {
  const [content, setContent] = useLessonPreparationText();
  const { analyze, result, loading, error } = useAnalysis<FullAuditResult>();
  const actionDisabled = loading || !content.trim();

  return (
    <ModuleShell
      eyebrow="Kwaliteitscontrole"
      title="Totale lesvoorbereiding audit"
      description="Een stoplichtscore op doelen, leerplandoelen, taal, timing, alignering en betrokkenheid."
      input={
        <div className="space-y-4">
          <LessonPreparationInput
            id="full-audit-content"
            value={content}
            onChange={setContent}
            rows={22}
            placeholder="Upload of plak de volledige concept-lesvoorbereiding…"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <ModuleActionButton
            disabled={actionDisabled}
            disabledReason="Upload of plak eerst je concept-lesvoorbereiding."
            onClick={() => analyze("/api/full-audit", { content })}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
            Start totale audit
          </ModuleActionButton>
        </div>
      }
      output={
        result ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-end justify-between">
                  <p className="text-sm text-neutral-500">Totale kwaliteitsscore</p>
                  <p className="text-3xl font-semibold">{result.data.score}%</p>
                </div>
                <Progress value={result.data.score} />
              </CardContent>
            </Card>
            {result.data.criteria.map((criterion) => (
              <Card key={criterion.label}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-sm">{criterion.label}</CardTitle>
                  <Badge className={criterion.status === "groen" ? "bg-emerald-700" : criterion.status === "oranje" ? "bg-orange-700" : "bg-red-700"}>{criterion.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-neutral-500">{criterion.finding}</p>
                  <div className="flex items-start justify-between gap-3 rounded-md bg-neutral-900 p-3">
                    <p>{criterion.improvement}</p><CopyButton value={criterion.improvement} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyOutput>De scorecard en kopieerbare verbeteringen verschijnen hier.</EmptyOutput>
        )
      }
    />
  );
}
