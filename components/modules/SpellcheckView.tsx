"use client";

import { useState } from "react";
import { CheckCheck, Loader2 } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonStore } from "@/stores/useLessonStore";

interface SpellcheckResult {
  improved: string;
  issues: Array<{ original: string; replacement: string; reason: string }>;
}

export function SpellcheckView() {
  const preparation = useLessonStore((state) => state.lesson.lessonPreparation);
  const syncPreparation = useLessonStore((state) => state.syncPreparation);
  const [content, setContent] = useState(preparation);
  const { analyze, result, loading, error } = useAnalysis<SpellcheckResult>();

  return (
    <ModuleShell
      eyebrow="Lesvoorbereiding"
      title="Didactische taalfoutencheck"
      description="Controleert dt-fouten, formele instructietaal, didactische terminologie en professionele stijl."
      input={
        <div className="space-y-4">
          <Label htmlFor="spell-content">Lesvoorbereidingstekst</Label>
          <Textarea id="spell-content" rows={18} value={content} onChange={(event) => setContent(event.target.value)} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button disabled={loading || !content.trim()} onClick={() => analyze("/api/spellcheck", { content })}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
            Controleer tekst
          </Button>
        </div>
      }
      output={
        result ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm">Verbeterde tekst</CardTitle>
                <CopyButton value={result.data.improved} />
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm leading-7">{result.data.improved}</CardContent>
            </Card>
            {result.data.issues.map((issue) => (
              <Card key={`${issue.original}-${issue.replacement}`}>
                <CardContent className="space-y-2 pt-5 text-sm">
                  <p><span className="text-red-400 line-through">{issue.original}</span> → <span className="text-emerald-400">{issue.replacement}</span></p>
                  <p className="text-xs text-neutral-500">{issue.reason}</p>
                </CardContent>
              </Card>
            ))}
            <Button onClick={() => { setContent(result.data.improved); syncPreparation(result.data.improved); }}>
              Vervang, verbeter & sync
            </Button>
            <Badge variant="outline">via {result.provider}</Badge>
          </div>
        ) : (
          <EmptyOutput>Suggesties en een volledig verbeterde versie verschijnen hier.</EmptyOutput>
        )
      }
    />
  );
}
