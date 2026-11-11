/** Decode exactly one XML entity layer. Unknown entities remain literal text. */
export function decodeXmlText(text: string) {
  return text.replace(/&(amp|lt|gt|quot|apos|#x[0-9a-f]+|#\d+);/gi, (entity, key: string) => {
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (key in named) return named[key];
    const code = key[1]?.toLowerCase() === "x" ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code) : entity;
  });
}

export function escapeXmlText(text: string) {
  return text.toWellFormed()
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
}
