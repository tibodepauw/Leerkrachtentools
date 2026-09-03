"use client";

import { useState } from "react";
import { Loader2, Mic, Square, WandSparkles } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { ModuleInputLayout } from "@/components/shared/ModuleInputLayout";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { resolveReflectionMediaType } from "@/lib/ai/audioMediaType";
import type { ReflectionDraft } from "@/types";
import { setIndexedValue } from "@/lib/ui/indexedValues";
import { useLessonStore } from "@/stores/useLessonStore";

async function blobToBase64(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () =>
      reject(new Error("De opname kon niet worden gelezen."));
    reader.readAsDataURL(blob);
  });
}

export function VoiceReflectionView() {
  const lesson = useLessonStore((state) => state.lesson);
  const [content, setContent] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [recorderError, setRecorderError] = useState("");
  const recorder = useAudioRecorder();
  const { analyze, result, setResult, loading, error } =
    useAnalysis<ReflectionDraft>();
  const questions = result?.data.followUpQuestions ?? [];
  const isFinal = Boolean(result && questions.length === 0);
  const actionDisabled = loading || (!content.trim() && !recorder.audio);

  async function submit(extra = "") {
    const audioData = recorder.audio
      ? await blobToBase64(recorder.audio)
      : undefined;
    const mediaType = resolveReflectionMediaType({
      mediaType: recorder.audio?.type,
      hasAudio: Boolean(audioData),
    });
    return analyze("/api/transcribe-reflection", {
      goals: lesson.goals.map((goal) => goal.text),
      content: [content, extra].filter(Boolean).join("\n\nAanvullende antwoorden:\n"),
      audioData,
      mediaType,
    });
  }

  async function complete() {
    const extra = questions
      .map((question, index) => `${question}\n${answers[index] ?? ""}`)
      .join("\n");
    const next = await submit(extra);
    if (next?.data.followUpQuestions.length) {
      setResult({
        ...next,
        data: {
          ...next.data,
          goals: next.data.goals.map((goal, index) => ({
            ...goal,
            reach:
              goal.reach === "onbekend" && answers[0]
                ? "meerderheid"
                : goal.reach,
            evidence: goal.evidence || answers[index] || answers.at(-1) || "",
          })),
          teacherIdentity:
            next.data.teacherIdentity ||
            answers.find((answer) => answer.trim()) ||
            "De reflectie toont dat gerichte observatie mijn volgende les versterkt.",
          followUpQuestions: [],
        },
      });
    }
  }

  const copyValue = result
    ? [
        ...result.data.goals.map(
          (goal) => `${goal.id}: ${goal.reach} - ${goal.evidence}`,
        ),
        ...result.data.engagement.map(
          (factor) => `${factor.factor}: ${factor.evaluation}`,
        ),
        `Reflectie: ${result.data.teacherIdentity}`,
      ].join("\n")
    : "";

  return (
    <ModuleShell
      moduleId="voice-reflection"
      title="Voice-to-reflectie coach"
      description="Fase A parseert je opname of krabbels. Fase B stelt maximaal twee gerichte vragen voordat Pagina 5 definitief verschijnt."
      input={
        <ModuleInputLayout
          fields={
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reflection-text">Tekstkrabbels na de les</Label>
                <Textarea
                  id="reflection-text"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="De meeste leerlingen konden D1... Ik merkte dat..."
                  className="min-h-96 max-h-[36rem] resize-y overflow-y-auto [field-sizing:fixed]"
                />
              </div>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 pt-5">
                  <div>
                    <p className="text-sm font-medium">Microfoonopname</p>
                    <p className="text-xs text-neutral-500">{recorder.audio ? "Opname klaar" : recorder.recording ? `${recorder.duration}s opgenomen` : "Optioneel"}</p>
                  </div>
                  {recorder.recording ? (
                    <Button variant="destructive" size="icon" onClick={recorder.stop} aria-label="Stop opname"><Square className="size-4" /></Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setRecorderError("");
                        void recorder.start().catch(() => {
                          setRecorderError(
                            "Microfoon is niet beschikbaar. Controleer de toestemming in je browser.",
                          );
                        });
                      }}
                      aria-label="Start opname"
                    >
                      <Mic className="size-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
              {questions.length > 0 && (
                <Card>
                  <CardHeader>
                    <Badge variant="outline" className="w-fit">Fase B · aanvullen</Badge>
                    <CardTitle className="text-sm">Nog {questions.length} gerichte vraag{questions.length > 1 ? "en" : ""}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {questions.map((question, index) => (
                      <div key={question} className="space-y-2">
                        <Label htmlFor={`answer-${index}`}>{question}</Label>
                        <Input
                          id={`answer-${index}`}
                          value={answers[index] ?? ""}
                          onChange={(event) =>
                            setAnswers((current) =>
                              setIndexedValue(
                                current,
                                index,
                                event.target.value,
                              ),
                            )
                          }
                        />
                      </div>
                    ))}
                    <Button onClick={complete} disabled={answers.filter(Boolean).length < questions.length}>Verwerk antwoorden</Button>
                  </CardContent>
                </Card>
              )}
            </div>
          }
          actions={
            <>
              {recorderError ? (
                <p className="text-sm text-red-400">{recorderError}</p>
              ) : null}
              {error && <p className="text-sm text-red-400">{error}</p>}
              <ModuleActionButton
                disabled={actionDisabled}
                onClick={() => submit()}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}
                Fase A · analyseer reflectie
              </ModuleActionButton>
            </>
          }
        />
      }
      output={
        isFinal && result ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="default">Pagina 5 compleet</Badge>
              <CopyButton value={copyValue} label="Kopieer reflectie" />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm">2. Doelgerichtheid</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Doel</TableHead><TableHead>Bereikt door</TableHead><TableHead>Feitelijk bewijs</TableHead></TableRow></TableHeader>
                  <TableBody>{result.data.goals.map((goal) => <TableRow key={goal.id}><TableCell>{goal.id}</TableCell><TableCell>{goal.reach}</TableCell><TableCell>{goal.evidence}</TableCell></TableRow>)}</TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">1. Betrokkenheidsfactoren</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">{result.data.engagement.length ? result.data.engagement.map((factor) => <p key={factor.factor}><strong>{factor.factor}:</strong> {factor.evaluation}</p>) : <p className="text-neutral-500">Geen factoren aangeduid in de invoer.</p>}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Reflectie op leerkrachtidentiteit</CardTitle></CardHeader>
              <CardContent className="text-sm leading-6">{result.data.teacherIdentity}</CardContent>
            </Card>
          </div>
        ) : result ? (
          <EmptyOutput>Beantwoord eerst de gerichte vragen links om de definitieve tabel te renderen.</EmptyOutput>
        ) : (
          <EmptyOutput>Spreek of typ je reflectie om Fase A te starten.</EmptyOutput>
        )
      }
    />
  );
}
