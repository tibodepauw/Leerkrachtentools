const timeUnitRegex = /(\d+)\s*(?:min|minuten|m)\b/i;
const phaseKeywordRegex =
  /instap|instructie|verwerking|afronding|lesfase|fase\s*(?:1|2|3|4|één|twee|drie|vier)?\b/i;
const dashHeaderRegex = /[-–—]\s*\d+\s*(?:min|minuten|m)\b/i;

function isPhaseTimingLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || !timeUnitRegex.test(trimmed)) return false;

  return (
    phaseKeywordRegex.test(trimmed) ||
    dashHeaderRegex.test(trimmed) ||
    (trimmed.length <= 56 && /\d+\s*(?:min|minuten|m)\b\s*$/i.test(trimmed))
  );
}

export function parsePhaseMinutes(content: string) {
  return content
    .split(/\r?\n/)
    .filter(isPhaseTimingLine)
    .map((line) => Number(line.match(timeUnitRegex)?.[1] ?? 0))
    .filter((value) => value > 0);
}

/** @deprecated */
export function parseMinutes(content: string) {
  return parsePhaseMinutes(content);
}

export function sumPhaseMinutes(content: string) {
  return parsePhaseMinutes(content).reduce((total, value) => total + value, 0);
}

export function timingDeviation(content: string, totalMinutes: number) {
  return sumPhaseMinutes(content) - totalMinutes;
}
