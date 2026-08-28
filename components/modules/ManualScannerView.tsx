"use client";

import { useState } from "react";
import { FileUp, Loader2, RefreshCw } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
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

const MAX_FILE_BYTES = 15 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Bestand kon niet worden gelezen."));
    reader.readAsDataURL(file);
  });
}

export function ManualScannerView() {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileData, setFileData] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [uploadError, setUploadError] = useState("");
  const { analyze, result, loading, error } =
    useAnalysis<ManualExtraction>();
  const syncFromExtraction = useLessonStore(
    (state) => state.syncFromExtraction,
  );

  async function submit(overrides?: {
    content?: string;
    fileName?: string;
    fileData?: string;
    mediaType?: string;
  }) {
    const payload = {
      content: overrides?.content ?? content,
      fileName: overrides?.fileName ?? fileName,
      fileData: overrides?.fileData ?? fileData,
      mediaType: overrides?.mediaType ?? mediaType,
    };

    if (!payload.content && !payload.fileName) return;

    await analyze("/api/extract-manual", payload);
  }

  async function selectFile(file?: File) {
    if (!file) return;
    setUploadError("");

    if (file.size > MAX_FILE_BYTES) {
      setUploadError("Het bestand mag maximaal 15 MB zijn.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      const nextMediaType = file.type || "application/octet-stream";
      const nextContent = file.type.startsWith("text/")
        ? atob(base64)
        : content;

      setFileName(file.name);
      setFileSize(file.size);
      setMediaType(nextMediaType);
      setFileData(base64);
      if (file.type.startsWith("text/")) setContent(nextContent);

      await submit({
        content: nextContent,
        fileName: file.name,
        fileData: base64,
        mediaType: nextMediaType,
      });
    } catch {
      setUploadError("Bestand kon niet worden gelezen.");
    }
  }

  const primaryText =
    loading && fileName
      ? "Gegevens worden geëxtraheerd…"
      : fileName || "PDF of afbeelding kiezen";

  const helperText =
    fileName && fileSize && !loading
      ? formatFileSize(fileSize)
      : !fileName
        ? "PDF, afbeelding of tekst · max. 15 MB"
        : null;

  return (
    <ModuleShell
      title="Handleiding Scanner"
      description="Upload een PDF of afbeelding van een handleiding. Gemini leest het document en extraheert leergebied, doelgroep en uitgeverijdoelen."
      input={
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="manual-file">Handleiding</Label>
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900/40 p-6 text-center hover:border-neutral-500">
              {loading && fileName ? (
                <Loader2 className="mb-3 size-6 animate-spin text-neutral-400" />
              ) : (
                <FileUp className="mb-3 size-6 text-neutral-400" />
              )}
              <span className="text-sm">{primaryText}</span>
              {helperText ? (
                <span className="mt-1 text-xs text-neutral-500">{helperText}</span>
              ) : null}
              <Input
                id="manual-file"
                type="file"
                accept=".pdf,image/*,.txt"
                className="sr-only"
                disabled={loading}
                onChange={(event) => {
                  void selectFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {uploadError ? (
              <p className="text-sm text-red-400">{uploadError}</p>
            ) : null}
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
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <ModuleActionButton
            onClick={() => submit()}
            disabled={loading || (!content && !fileName)}
            disabledReason="Upload een handleiding of plak eerst tekst in het invoerveld."
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Gegevens extraheren
          </ModuleActionButton>
        </div>
      }
      output={
        result ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">via {result.provider}</Badge>
              <CopyButton
                value={JSON.stringify(result.data, null, 2)}
                label="Kopieer alles"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Leergebied", result.data.learningArea],
                ["Onderdeel", result.data.component],
                ["Lesonderwerp", result.data.topic],
                ["Doelgroep", result.data.targetGroup],
              ].map(([label, value]) => (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-neutral-500">
                      {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {value || "Niet gevonden"}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ruwe uitgeverijdoelen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {result.data.rawPublisherGoals.map((goal) => (
                  <p key={goal}>• {goal}</p>
                ))}
              </CardContent>
            </Card>
            <Button onClick={() => syncFromExtraction(result.data)}>
              Zet alles in actieve les
            </Button>
          </div>
        ) : (
          <EmptyOutput>
            Upload een handleiding om de lessituering en doelen te extraheren.
          </EmptyOutput>
        )
      }
    />
  );
}
