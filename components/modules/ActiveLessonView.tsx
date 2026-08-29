"use client";

import { Download, FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LessonDocumentPreview } from "@/components/shared/LessonDocumentPreview";
import { getLessonDocument } from "@/lib/documents/documentStorage";
import { syncPreparationDocumentFromFile } from "@/lib/documents/syncPreparationDocument";
import { LESSON_DOCUMENT_ACCEPT } from "@/lib/documents/supportedFormats";
import { useLessonStore } from "@/stores/useLessonStore";
import type { LessonExportPayload } from "@/types";

function downloadName(topic: string, sourceFileName?: string | null) {
  if (sourceFileName?.toLowerCase().endsWith(".docx")) {
    const base = sourceFileName.replace(/\.docx$/iu, "");
    return `${base}-bijgewerkt.docx`;
  }

  const safeTopic = topic
    .trim()
    .toLocaleLowerCase("nl-BE")
    .replace(/[^a-z0-9à-ÿ]+/giu, "-")
    .replace(/^-|-$/gu, "");
  return `lesvoorbereiding-${safeTopic || "formulier"}.docx`;
}

function fileNameFromDisposition(header: string | null) {
  if (!header) return null;
  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
}

export function ActiveLessonView() {
  const lesson = useLessonStore((state) => state.lesson);
  const syncPreparation = useLessonStore((state) => state.syncPreparation);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const activeGoals = lesson.goals.filter((goal) => goal.text.trim());
  const preparationDocument = lesson.preparationDocument ?? null;
  const canExportDocx = preparationDocument?.fileName
    ?.toLowerCase()
    .endsWith(".docx");

  function openUploadDialog() {
    uploadInputRef.current?.click();
  }

  async function uploadLesson(file?: File) {
    if (!file) return;
    setUploading(true);
    setUploadError("");

    try {
      await syncPreparationDocumentFromFile(file);

      const formData = new FormData();
      formData.append("file", file);
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
    if (!canExportDocx) {
      setDownloadError(
        "Upload eerst je lesvoorbereidingsformulier als .docx om het bij te werken.",
      );
      return;
    }

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
      const formData = new FormData();
      formData.append("lesson", JSON.stringify(payload));

      if (preparationDocument) {
        const sourceBlob = await getLessonDocument(preparationDocument.id);
        if (sourceBlob) {
          formData.append(
            "sourceDocument",
            new File([sourceBlob], preparationDocument.fileName, {
              type: preparationDocument.mimeType || sourceBlob.type,
            }),
          );
        }
      }

      const response = await fetch("/api/export-lesson-document", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
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
      anchor.download =
        fileNameFromDisposition(response.headers.get("Content-Disposition")) ??
        downloadName(lesson.topic, preparationDocument?.fileName);
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
            Bekijk je originele lesvoorbereiding als document. De Word-download
            past je geüploade formulier aan met je actuele lesdoelen en
            lescontext.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Input
            ref={uploadInputRef}
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
            onClick={openUploadDialog}
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
            disabled={downloading || !canExportDocx}
            title={
              canExportDocx
                ? "Download bijgewerkt Word-formulier"
                : "Upload eerst een .docx-formulier"
            }
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
              <CardTitle className="text-sm">Lescontext</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {[
                  ["Onderwerp", lesson.topic],
                  ["Doelgroep", lesson.displayTargetGroup || lesson.targetGroup],
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
          <CardContent className="flex flex-1 flex-col gap-3">
            <LessonDocumentPreview
              document={preparationDocument}
              fallbackText={lesson.lessonPreparation}
              onUpload={openUploadDialog}
            />
            <p className="text-xs text-neutral-500">
              Je ziet hier het originele Word- of PDF-bestand. Bij downloaden
              wordt je geüploade .docx-formulier bijgewerkt met je actuele
              doelen. Het Thomas More-formulier staat niet in deze repo: gebruik
              het sjabloon van je opleiding en upload het hier lokaal.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
