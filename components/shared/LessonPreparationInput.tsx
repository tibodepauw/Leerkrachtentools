"use client";

import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LESSON_DOCUMENT_ACCEPT } from "@/lib/documents/supportedFormats";
import { syncPreparationDocumentFromFile } from "@/lib/documents/syncPreparationDocument";
import { ActiveLessonPrepHint } from "@/components/shared/ActiveLessonPrepHint";
import { ScrollFrame } from "@/components/shared/ScrollFrame";

interface LessonPreparationInputProps {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  frameHeightClassName?: string;
}

export function LessonPreparationInput({
  id,
  label = "Lesvoorbereiding",
  value,
  onChange,
  placeholder = "Plak je lesvoorbereiding of upload een document…",
  frameHeightClassName = "h-72",
}: LessonPreparationInputProps) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [uploadError, setUploadError] = useState("");

  async function handleFile(file?: File) {
    if (!file) return;
    setUploading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/import-lesson-document", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as {
      error?: string;
      text?: string;
      fileName?: string;
    };

    setUploading(false);

    if (!response.ok || !payload.text) {
      setUploadError(payload.error ?? "Upload mislukt.");
      return;
    }

    setFileName(payload.fileName ?? file.name);
    await syncPreparationDocumentFromFile(file).catch(() => undefined);
    onChange(payload.text);
  }

  return (
    <div className="space-y-3">
      <Label htmlFor={id}>{label}</Label>
      <ActiveLessonPrepHint />
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900/40 p-5 text-center transition-colors hover:border-neutral-500">
        {uploading ? (
          <Loader2 className="mb-2 size-6 animate-spin text-neutral-400" />
        ) : (
          <FileUp className="mb-2 size-6 text-neutral-400" />
        )}
        <span className="text-sm">
          {uploading
            ? "Document wordt ingelezen…"
            : fileName || "Upload lesvoorbereiding"}
        </span>
        <span className="mt-1 text-xs text-neutral-500">
          {fileName
            ? "Geïmporteerd — pas de tekst hieronder gerust nog aan"
            : "PDF, DOC, DOCX, ODT, RTF, TXT · max. 15 MB"}
        </span>
        <Input
          id={`${id}-upload`}
          type="file"
          accept={LESSON_DOCUMENT_ACCEPT}
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      {uploadError ? <p className="text-sm text-red-400">{uploadError}</p> : null}
      <ScrollFrame heightClassName={frameHeightClassName} innerScroll={false}>
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-full min-h-0 resize-none overflow-y-auto rounded-none border-0 bg-transparent [field-sizing:fixed] focus-visible:ring-0"
        />
      </ScrollFrame>
    </div>
  );
}
