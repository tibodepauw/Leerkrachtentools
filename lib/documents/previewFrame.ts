// Documents may contain arbitrary CSS and links. Keep their DOM outside the
// application. Same-origin allows the renderer to populate the frame; scripts,
// forms, popups and top navigation remain disabled by its sandbox.
export const DOCUMENT_PREVIEW_SANDBOX = "allow-same-origin";
export const DOCUMENT_PREVIEW_HTML = `<!doctype html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<style>body{margin:0;background:#e5e5e5}#document{overflow:auto}</style>
</head><body><div id="document"></div></body></html>`;

export function preventPreviewNavigation(frameDocument: Document) {
  // A document preview is not a browser. Block navigation even to the frame's
  // own URL, including javascript:, external hyperlinks and linked resources.
  const blockLink = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.closest?.("a")) event.preventDefault();
  };
  frameDocument.addEventListener("click", blockLink, true);
  frameDocument.addEventListener("auxclick", blockLink, true);
  return () => {
    frameDocument.removeEventListener("click", blockLink, true);
    frameDocument.removeEventListener("auxclick", blockLink, true);
  };
}
