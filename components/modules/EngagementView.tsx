"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonStore } from "@/stores/useLessonStore";

interface EngagementResult {
  factors: Array<{
    name: string;
    status: "aanwezig" | "gedeeltelijk" | "ontbreekt";
    evidence: string;
    suggestion: string;
  }>;
}

export function EngagementView() {
  const lesson = useLessonStore((state) => state.lesson);
  const syncPreparation = useLessonStore((state) => state.syncPreparation);
  const setField = useLessonStore((state) => state.setField);
  const [content, setContent] = useState(lesson.lessonPreparation);
  const { analyze, result, loading, error } = useAnalysis<EngagementResult>();

  function syncFactors() {
    if (!result) return;
    setField(
      "engagementFactors",
      result.data.factors
        .filter((factor) => factor.status !== "ontbreekt")
        .map((factor) => factor.name),
    );
  }

  return (
    <ModuleShell
      eyebrow="Kwaliteitscontrole"
      title="Betrokkenheidsfactoren van Laevers"
      description="Zelfstandige analyse van Leeractiviteit, Werkelijkheidsnabijheid, Leerlingeninitiatief, Positief klasklimaat, Expressie en Samen leren."
      input={
        <div className="space-y-4">
          <Label htmlFor="engagement-content">Volledige lesvoorbereiding</Label>
          <Textarea id="engagement-content" rows={20} value={content} onChange={(event) => setContent(event.target.value)} />
          <Button variant="outline" onClick={() => syncPreparation(content)}>Sync invoer naar sessie</Button>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button disabled={loading || !content.trim()} onClick={() => analyze("/api/audit-engagement", { content })}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Analyseer zes factoren
          </Button>
        </div>
      }
      output={
        result ? (
          <div className="space-y-3">
            {result.data.factors.map((factor) => (
              <Card key={factor.name}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-sm">{factor.name}</CardTitle>
                  <Badge variant={factor.status === "aanwezig" ? "default" : "outline"}>{factor.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-neutral-400">{factor.evidence}</p>
                  <div className="flex items-start justify-between gap-3 rounded-md bg-neutral-900 p-3">
                    <p>{factor.suggestion}</p><CopyButton value={factor.suggestion} />
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button onClick={syncFactors}>Sync gerealiseerde factoren</Button>
          </div>
        ) : (
          <EmptyOutput>Alle zes factoren krijgen bewijs, status en een concrete suggestie.</EmptyOutput>
        )
      }
    />
  );
}
