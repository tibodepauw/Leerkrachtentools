"use client";

import { Download, FileText, FileUp, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getLessonDocument } from "@/lib/documents/documentStorage";
import { previewModeFromFileName } from "@/lib/documents/preview";
import { DOCUMENT_PREVIEW_HTML, DOCUMENT_PREVIEW_SANDBOX, preventPreviewNavigation } from "@/lib/documents/previewFrame";
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
  const docxFrameRef = useRef<HTMLIFrameElement>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const previewMode = previewModeFromFileName(document.fileName);
  const pdfUrl = useMemo(() => {
    if (!blob || previewMode !== "pdf") {
      return null;
    }
    return URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
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
    const frameDocument = docxFrameRef.current?.contentDocument;
    const container = frameDocument?.getElementById("document");
    if (!frameReady || !frameDocument || !container || !blob || previewMode !== "docx") return;

    let cancelled = false;
    container.replaceChildren();
    const restoreNavigation = preventPreviewNavigation(frameDocument);

    void import("docx-preview")
      .then(({ renderAsync }) => {
        if (cancelled) return;
        return renderAsync(blob, container, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          renderAltChunks: false,
        });
      })
      .then(() => {
        if (cancelled) container.replaceChildren();
        // Also remove link destinations so context-menu navigation cannot open
        // an untrusted target outside the preview.
        container.querySelectorAll("a").forEach((link) => link.removeAttribute("href"));
      })
      .catch(() => {
        if (!cancelled) {
          setError("Dit Word-bestand kon niet worden weergegeven.");
        }
      });

    return () => {
      cancelled = true;
      restoreNavigation();
      container.replaceChildren();
    };
  }, [blob, previewMode, frameReady]);

  return (
    <div className="ph-no-capture flex min-h-[32rem] flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
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
          referrerPolicy="no-referrer"
          className="min-h-[32rem] flex-1 bg-neutral-200"
        />
      ) : previewMode === "docx" ? (
        <iframe
          ref={docxFrameRef}
          title={`Word-preview: ${document.fileName}`}
          sandbox={DOCUMENT_PREVIEW_SANDBOX}
          srcDoc={DOCUMENT_PREVIEW_HTML}
          referrerPolicy="no-referrer"
          onLoad={() => setFrameReady(true)}
          className="min-h-[32rem] w-full flex-1 border-0 bg-neutral-200"
        />
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
