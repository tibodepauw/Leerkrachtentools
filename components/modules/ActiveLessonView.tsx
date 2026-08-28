"use client";

import { Download, FileText, FileUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LESSON_DOCUMENT_ACCEPT } from "@/lib/documents/supportedFormats";
import { useLessonStore } from "@/stores/useLessonStore";
import { useState } from "react";
import type { LessonExportPayload } from "@/types";

function downloadName(topic: string) {
  const safeTopic = topic
    .trim()
    .toLocaleLowerCase("nl-BE")
    .replace(/[^a-z0-9à-ÿ]+/giu, "-")
    .replace(/^-|-$/gu, "");
  return `lesvoorbereiding-${safeTopic || "actieve-les"}.docx`;
}

export function ActiveLessonView() {
  const lesson = useLessonStore((state) => state.lesson);
  const syncPreparation = useLessonStore((state) => state.syncPreparation);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const activeGoals = lesson.goals.filter((goal) => goal.text.trim());

  async function uploadLesson(file?: File) {
    if (!file) return;
    setUploading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/import-lesson-document", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        text?: string;
      };

      if (!response.ok || !payload.text) {
        throw new Error(payload.error ?? "Upload mislukt.");
      }

      syncPreparation(payload.text);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Upload mislukt.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function downloadLesson() {
    setDownloading(true);
    setDownloadError("");

    try {
      const payload: LessonExportPayload = {
        topic: lesson.topic,
        learningArea: lesson.learningArea,
        component: lesson.component,
        targetGroup: lesson.targetGroup,
        materials: lesson.materials,
        goals: lesson.goals,
        totalMinutes: lesson.totalMinutes,
        educationNetwork: lesson.educationNetwork,
        lessonPreparation: lesson.lessonPreparation,
      };
      const response = await fetch("/api/export-lesson-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Downloaden is mislukt.");
      }

      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName(lesson.topic);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Downloaden is mislukt.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 lg:p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Actieve les</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
            Dit is de actuele versie van je les. Verbeteringen die je bewaart in
            andere modules verschijnen hier en worden meegenomen in de download.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Input
            id="active-lesson-upload"
            type="file"
            accept={LESSON_DOCUMENT_ACCEPT}
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              void uploadLesson(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={uploading}
            aria-label="Lesvoorbereiding uploaden"
            title="Lesvoorbereiding uploaden"
            onClick={() =>
              document.getElementById("active-lesson-upload")?.click()
            }
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
          </Button>
          <Button
            type="button"
            onClick={downloadLesson}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download als Word
          </Button>
        </div>
      </div>

      {downloadError || uploadError ? (
        <p className="mb-4 text-sm text-red-400">
          {downloadError || uploadError}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="size-4" />
                Lescontext
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {[
                  ["Onderwerp", lesson.topic],
                  ["Doelgroep", lesson.targetGroup],
                  ["Leergebied", lesson.learningArea],
                  ["Onderdeel", lesson.component],
                  ["Onderwijsnet", lesson.educationNetwork],
                  ["Totale lestijd", `${lesson.totalMinutes} min`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-neutral-500">{label}</dt>
                    <dd className="mt-1">{value || "Nog niet ingevuld"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                Actuele lesdoelen
                <Badge variant="outline">{activeGoals.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeGoals.length > 0 ? (
                activeGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="rounded-lg border border-neutral-800 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline">{goal.id}</Badge>
                      {goal.taxonomy ? (
                        <span className="text-xs text-neutral-500">
                          {goal.taxonomy}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm leading-6">{goal.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500">
                  Nog geen doelen gevonden. Upload eerst een document in de
                  Handleiding Scanner of vul doelen in via Actieve les.
                </p>
              )}
            </CardContent>
          </Card>

          {lesson.materials.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Materialen</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6">
                {lesson.materials.join(", ")}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="min-h-[calc(100vh-12rem)]">
          <CardHeader>
            <CardTitle className="text-sm">Actuele lesvoorbereiding</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-2">
            <Label htmlFor="active-lesson-document" className="sr-only">
              Actuele lesvoorbereiding
            </Label>
            <Textarea
              id="active-lesson-document"
              value={lesson.lessonPreparation}
              onChange={(event) => syncPreparation(event.target.value)}
              placeholder="Upload je lesvoorbereiding in een module. De actuele versie verschijnt hier en blijft bewerkbaar."
              className="min-h-[32rem] flex-1 resize-y leading-7"
            />
            <p className="text-xs text-neutral-500">
              Wijzigingen worden direct bewaard in je actieve les. Verbeterde
              doelen worden hierboven weergegeven en in de Word-download gezet.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
