"use client";

import { useMemo, useState } from "react";
import { Clock3, Loader2 } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { parseMinutes } from "@/lib/timing";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonStore } from "@/stores/useLessonStore";

interface TimingResult {
  suggestions: string[];
  rationale: string;
}

export function TimingCheckView() {
  const lesson = useLessonStore((state) => state.lesson);
  const setField = useLessonStore((state) => state.setField);
  const [content, setContent] = useState(lesson.lessonPreparation);
  const { analyze, result, loading, error } = useAnalysis<TimingResult>();
  const minutes = useMemo(() => parseMinutes(content), [content]);
  const sum = minutes.reduce((total, value) => total + value, 0);
  const deviation = sum - lesson.totalMinutes;
  const status = deviation === 0 ? "groen" : Math.abs(deviation) <= 5 ? "oranje" : "rood";

  return (
    <ModuleShell
      eyebrow="Lesvoorbereiding"
      title="Timing & tijdscontrole"
      description="De som wordt direct en deterministisch berekend. AI wordt uitsluitend gebruikt voor didactische optimalisaties."
      input={
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="total-time">Totale lestijd (minuten)</Label>
            <Input id="total-time" type="number" min={1} value={lesson.totalMinutes} onChange={(event) => setField("totalMinutes", Number(event.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timing-content">Vier lesfasen met minuten in de headers</Label>
            <Textarea
              id="timing-content"
              rows={18}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={"Instapfase — 5 min\n...\nInstructiefase — 15 minuten\n...\nVerwerking — 25 m\n...\nAfronding — 5 min"}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            disabled={loading || minutes.length === 0}
            onClick={() => analyze("/api/audit-timing", { totalMinutes: String(lesson.totalMinutes), content: `Gevonden tijden: ${minutes.join(", ")}. Som: ${sum}. Afwijking: ${deviation}.` })}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Clock3 className="size-4" />}
            Vraag optimalisaties
          </Button>
        </div>
      }
      output={
        <div className="space-y-4">
          <Card className={cn(status === "groen" && "border-emerald-800", status === "oranje" && "border-orange-800", status === "rood" && "border-red-900")}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">Wiskundige controle</CardTitle>
              <Badge className={cn(status === "groen" && "bg-emerald-600", status === "oranje" && "bg-orange-600", status === "rood" && "bg-red-700")}>{status}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-semibold">{sum} / {lesson.totalMinutes} min</p>
              <p className="text-sm text-neutral-500">
                {minutes.length ? `${minutes.length} tijden gevonden: ${minutes.join(" + ")}` : "Nog geen minuten gevonden."}
              </p>
              {deviation !== 0 && <p className="text-sm">{Math.abs(deviation)} minuten {deviation > 0 ? "te veel" : "te weinig"}.</p>}
            </CardContent>
          </Card>
          {result ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm">Didactische suggesties</CardTitle>
                <CopyButton value={result.data.suggestions.join("\n")} />
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {result.data.suggestions.map((suggestion) => <p key={suggestion}>• {suggestion}</p>)}
              </CardContent>
            </Card>
          ) : (
            <EmptyOutput>De tijdsstatus werkt direct; vraag daarna optionele suggesties.</EmptyOutput>
          )}
        </div>
      }
    />
  );
}
