"use client";

import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LESSON_DOCUMENT_ACCEPT } from "@/lib/documents/supportedFormats";
import { syncPreparationDocumentFromFile } from "@/lib/documents/syncPreparationDocument";
import { ActiveLessonPrepHint } from "@/components/shared/ActiveLessonPrepHint";
import { useAutoSyncPreparationText } from "@/hooks/useAutoSyncPreparationText";
import { useLessonStore } from "@/stores/useLessonStore";
import { cn } from "@/lib/utils";

interface LessonPreparationInputProps {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
  maxHeightClassName?: string;
  className?: string;
}

export function LessonPreparationInput({
  id,
  label = "Lesvoorbereiding",
  value,
  onChange,
  placeholder = "Plak je lesvoorbereiding of upload een document…",
  minHeightClassName = "min-h-[36rem]",
  maxHeightClassName = "max-h-[80vh]",
  className,
}: LessonPreparationInputProps) {
  const preparationDocument = useLessonStore(
    (state) => state.lesson.preparationDocument,
  );
  const { syncing, syncError } = useAutoSyncPreparationText();
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const linkedDocumentName = preparationDocument?.fileName ?? "";
  const showLinkedDocument = Boolean(linkedDocumentName && !fileName);
  const importStatusText = uploading
    ? "Document wordt ingelezen…"
    : syncing
      ? "Tekst wordt geladen uit actieve les…"
      : fileName || (showLinkedDocument ? linkedDocumentName : "Upload lesvoorbereiding");
  const importHelperText = uploading
    ? null
    : syncing
      ? "Je geüploade document uit Actieve les wordt omgezet naar tekst."
      : fileName
        ? "Geïmporteerd - pas de tekst hieronder gerust nog aan"
        : showLinkedDocument
          ? "Gekoppeld aan Actieve les - tekst staat hieronder klaar voor analyse"
          : "PDF, DOC, DOCX, ODT, RTF, TXT · max. 15 MB";

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
    <div className={cn("space-y-3", className)}>
      <Label htmlFor={id}>{label}</Label>
      <ActiveLessonPrepHint />
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900/40 p-5 text-center transition-colors hover:border-neutral-500",
          showLinkedDocument ? "min-h-20 py-3" : "min-h-28",
        )}
      >
        {uploading || syncing ? (
          <Loader2 className="mb-2 size-6 animate-spin text-neutral-400" />
        ) : (
          <FileUp className="mb-2 size-6 text-neutral-400" />
        )}
        <span className="text-sm">{importStatusText}</span>
        {importHelperText ? (
          <span className="mt-1 text-xs text-neutral-500">{importHelperText}</span>
        ) : null}
        <Input
          id={`${id}-upload`}
          type="file"
          accept={LESSON_DOCUMENT_ACCEPT}
          className="sr-only"
          disabled={uploading || syncing}
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      {uploadError || syncError ? (
        <p className="text-sm text-red-400">{uploadError || syncError}</p>
      ) : null}
      <Textarea
        id={id}
        rows={24}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "field-sizing-fixed w-full resize-y overflow-y-auto",
          minHeightClassName,
          maxHeightClassName,
        )}
      />
    </div>
  );
}
