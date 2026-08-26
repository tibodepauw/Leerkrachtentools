"use client";

import { useState } from "react";
import { FileUp, Loader2, RefreshCw } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonStore } from "@/stores/useLessonStore";
import type { ManualExtraction } from "@/types";

export function ManualScannerView() {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileData, setFileData] = useState("");
  const [mediaType, setMediaType] = useState("");
  const { analyze, result, loading, error } =
    useAnalysis<ManualExtraction>();
  const syncFromExtraction = useLessonStore(
    (state) => state.syncFromExtraction,
  );

  async function selectFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    setMediaType(file.type || "application/octet-stream");
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      setFileData(value.includes(",") ? value.split(",")[1] : value);
      if (file.type.startsWith("text/")) setContent(atob(value.split(",")[1]));
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    await analyze("/api/extract-manual", {
      content,
      fileName,
      fileData,
      mediaType,
    });
  }

  return (
    <ModuleShell
      eyebrow="Input & extractie"
      title="Handleiding Scanner"
      description="Upload een PDF of afbeelding van een handleiding. Met Gemini wordt het document visueel gelezen; zonder key krijg je een duidelijke lokale demo."
      input={
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="manual-file">Handleiding</Label>
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900/40 p-6 text-center hover:border-neutral-500">
              <FileUp className="mb-3 size-6 text-neutral-400" />
              <span className="text-sm">{fileName || "PDF of afbeelding kiezen"}</span>
              <span className="mt-1 text-xs text-neutral-500">Maximaal 15 MB</span>
              <Input
                id="manual-file"
                type="file"
                accept=".pdf,image/*,.txt"
                className="sr-only"
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
            </label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-content">Of plak relevante tekst</Label>
            <Textarea
              id="manual-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={10}
              placeholder="Plak hier tekst uit de methode of handleiding..."
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button onClick={submit} disabled={loading || (!content && !fileName)}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Gegevens extraheren
          </Button>
        </div>
      }
      output={
        result ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">via {result.provider}</Badge>
              <CopyButton value={JSON.stringify(result.data, null, 2)} label="Kopieer alles" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Leergebied", result.data.learningArea],
                ["Onderdeel", result.data.component],
                ["Lesonderwerp", result.data.topic],
                ["Doelgroep", result.data.targetGroup],
              ].map(([label, value]) => (
                <Card key={label}>
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-neutral-500">{label}</CardTitle></CardHeader>
                  <CardContent className="text-sm">{value || "Niet gevonden"}</CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm">Ruwe uitgeverijdoelen</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {result.data.rawPublisherGoals.map((goal) => <p key={goal}>• {goal}</p>)}
              </CardContent>
            </Card>
            <Button onClick={() => syncFromExtraction(result.data)}>
              Zet alles in actieve les
            </Button>
          </div>
        ) : (
          <EmptyOutput>Upload een handleiding om de lessituering en doelen te extraheren.</EmptyOutput>
        )
      }
    />
  );
}
