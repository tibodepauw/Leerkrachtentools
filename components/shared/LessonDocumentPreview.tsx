"use client";

import { Download, FileText, FileUp, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getLessonDocument } from "@/lib/documents/documentStorage";
import { previewModeFromFileName } from "@/lib/documents/preview";
import type { LessonPreparationDocument } from "@/types";

interface LessonDocumentPreviewProps {
  document: LessonPreparationDocument | null;
  fallbackText?: string;
  onUpload?: () => void;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function LoadedLessonDocumentPreview({
  document,
  fallbackText = "",
  onUpload,
}: {
  document: LessonPreparationDocument;
  fallbackText?: string;
  onUpload?: () => void;
}) {
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const previewMode = previewModeFromFileName(document.fileName);
  const pdfUrl = useMemo(() => {
    if (!blob || previewMode !== "pdf") {
      return null;
    }
    return URL.createObjectURL(blob);
  }, [blob, previewMode]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError("");
    });

    void getLessonDocument(document.id)
      .then((storedBlob) => {
        if (cancelled) return;

        if (!storedBlob) {
          setBlob(null);
          setError(
            "Het originele bestand is niet meer beschikbaar. Upload je lesvoorbereiding opnieuw.",
          );
          return;
        }

        setBlob(storedBlob);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Het document kon niet worden geladen.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [document.id]);

  useEffect(() => {
    if (!pdfUrl) return;
    return () => {
      URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    const container = docxContainerRef.current;
    if (!container || !blob || previewMode !== "docx") return;

    let cancelled = false;
    container.replaceChildren();

    void import("docx-preview")
      .then(({ renderAsync }) =>
        renderAsync(blob, container, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
        }),
      )
      .catch(() => {
        if (!cancelled) {
          setError("Dit Word-bestand kon niet worden weergegeven.");
        }
      });

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [blob, previewMode]);

  return (
    <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{document.fileName}</p>
          <p className="text-xs text-neutral-500">
            {previewMode === "pdf"
              ? "PDF-preview"
              : previewMode === "docx"
                ? "Word-preview"
                : previewMode === "text"
                  ? "Tekstpreview"
                  : "Download-only"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onUpload ? (
            <Button type="button" variant="outline" size="sm" onClick={onUpload}>
              <FileUp className="size-4" />
              Vervangen
            </Button>
          ) : null}
          {blob ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadBlob(blob, document.fileName)}
            >
              <Download className="size-4" />
              Origineel
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-red-400">{error}</p>
          {onUpload ? (
            <Button type="button" variant="outline" onClick={onUpload}>
              <FileUp className="size-4" />
              Opnieuw uploaden
            </Button>
          ) : null}
        </div>
      ) : previewMode === "pdf" && pdfUrl ? (
        <iframe
          title={document.fileName}
          src={pdfUrl}
          className="min-h-[32rem] flex-1 bg-neutral-200"
        />
      ) : previewMode === "docx" ? (
        <div className="min-h-[32rem] flex-1 overflow-auto bg-neutral-200 p-4">
          <div
            ref={docxContainerRef}
            className="mx-auto max-w-[820px] rounded-sm bg-white shadow-sm"
          />
        </div>
      ) : previewMode === "text" && fallbackText.trim() ? (
        <div className="min-h-[32rem] flex-1 overflow-auto p-6">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-neutral-200">
            {fallbackText}
          </pre>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-neutral-400">
            Voor dit bestandstype is geen ingebouwde preview beschikbaar.
          </p>
          {blob ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadBlob(blob, document.fileName)}
            >
              <Download className="size-4" />
              Download origineel bestand
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function LessonDocumentPreview({
  document,
  fallbackText = "",
  onUpload,
}: LessonDocumentPreviewProps) {
  if (!document) {
    return (
      <div className="flex min-h-[32rem] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-950/40 p-8 text-center">
        <FileText className="mb-4 size-10 text-neutral-500" />
        <p className="text-sm font-medium">Nog geen lesvoorbereiding geüpload</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-neutral-400">
          Upload een Word- of PDF-bestand om hier een echte documentpreview te
          zien. Andere modules gebruiken intern nog steeds de geëxtraheerde tekst
          voor analyse.
        </p>
        {fallbackText.trim() ? (
          <p className="mt-3 text-xs text-neutral-500">
            Er staat wel tekst klaar uit eerdere modules, maar zonder
            origineel bestand is er geen opmaak-preview mogelijk.
          </p>
        ) : null}
        {onUpload ? (
          <Button type="button" variant="outline" className="mt-5" onClick={onUpload}>
            <FileUp className="size-4" />
            Document uploaden
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <LoadedLessonDocumentPreview
      key={document.id}
      document={document}
      fallbackText={fallbackText}
      onUpload={onUpload}
    />
  );
}
