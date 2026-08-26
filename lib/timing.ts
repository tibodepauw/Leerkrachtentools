const timingRegex = /(\d+)\s*(?:min|minuten|m)\b/gi;

export function parseMinutes(content: string) {
  return Array.from(content.matchAll(timingRegex)).map((match) =>
    Number(match[1]),
  );
}
