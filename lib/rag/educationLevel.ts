import type {
  CurriculumSearchResult,
  EducationLevelFilter,
} from "@/types";
import { ahovoksMetaFromGoal } from "@/lib/rag/ahovoksMinimumGoals";

type RawRecord = Record<string, unknown>;

const KLEUTER_MAX_AGE = 6;
const LAGER_MIN_AGE = 6;
const LAGER_MAX_AGE = 12;

const DOMAIN_LEVELS = new Set<EducationLevelFilter>([
  "BUBAO",
  "BUSO",
  "OKAN",
  "DKO",
  "VOLWASSENEN",
  "HOGER",
]);

function collectStrings(value: unknown, output: string[]): void {
  if (typeof value === "string") {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value as RawRecord).forEach((item) =>
      collectStrings(item, output),
    );
  }
}

function ageRanges(raw: RawRecord): Array<[number, number]> {
  const strings: string[] = [];
  collectStrings(
    {
      leerjaren: raw.leerjaren,
      leerlijn: raw.leerlijn,
      inhouden: raw.inhouden,
    },
    strings,
  );

  return strings.flatMap((value) => {
    const ranges: Array<[number, number]> = [];
    for (const match of value.matchAll(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*j?/giu)) {
      const start = Number(match[1]?.replace(",", "."));
      const end = Number(match[2]?.replace(",", "."));
      if (Number.isFinite(start) && Number.isFinite(end)) {
        ranges.push([Math.min(start, end), Math.max(start, end)]);
      }
    }
    return ranges;
  });
}

function explicitLevelText(raw: RawRecord): string {
  return [
    raw.onderwijsniveau,
    raw.onderwijs_niveau,
    raw.schoolniveau,
    raw.niveau_onderwijs,
    raw.fase,
    raw.leerjaar_route,
    raw.graad,
    raw.finaliteit,
    raw.code,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase("nl-BE");
}

function recordDomain(raw: RawRecord): EducationLevelFilter | "" {
  const level = String(raw.onderwijsniveau ?? "").toUpperCase();
  if (level === "SECUNDAIR") return "SECUNDAIR";
  if (level === "BUBAO") return "BUBAO";
  if (level === "BUSO") return "BUSO";
  if (level === "OKAN") return "OKAN";
  if (level === "DKO") return "DKO";
  if (level === "VOLWASSENEN") return "VOLWASSENEN";
  if (level === "HOGER") return "HOGER";
  if (level === "KLEUTER") return "KLEUTER";
  if (level === "LAGER") return "LAGER";
  return "";
}

export function recordMatchesEducationLevel(
  raw: RawRecord,
  level: EducationLevelFilter,
): boolean {
  if (level === "ALL") return true;

  const domain = recordDomain(raw);
  if (domain) {
    if (level === "BASISONDERWIJS") {
      return domain === "KLEUTER" || domain === "LAGER";
    }
    return domain === level;
  }

  const text = explicitLevelText(raw);
  if (level === "SECUNDAIR") {
    if (text.includes("secundair")) {
      return true;
    }
    if (String(raw.onderwijsniveau ?? "").toUpperCase() === "SECUNDAIR") {
      return true;
    }
    return /\b(?:1ste|2de|3de|eerste|tweede|derde)\s+graad\b|finaliteit|[AB]-stroom/u.test(
      text,
    );
  }

  if (level === "BASISONDERWIJS") {
    if (/\b(secundair|so|aso|tso|bso|kso|buitengewoon secundair)\b/u.test(text)) {
      return false;
    }
    return (
      /\b(kleuter|peuter|kleuterklas|\.kl\d*)\b/u.test(text) ||
      /\b(lager onderwijs|leerjaar|\.gl\d*)\b/u.test(text) ||
      ageRanges(raw).length > 0
    );
  }

  if (DOMAIN_LEVELS.has(level)) {
    return false;
  }

  if (/\b(secundair|so|aso|tso|bso|kso)\b/u.test(text)) {
    return false;
  }

  const linked = raw.gelinkt_minimumdoel;
  const linkedCode =
    linked && typeof linked === "object"
      ? String((linked as RawRecord).code ?? "")
      : "";
  if (/^K-/iu.test(linkedCode)) return level === "KLEUTER";
  if (/^[46]-/u.test(linkedCode)) return level === "LAGER";

  if (/\b(kleuter|peuter|kleuterklas|\.kl\d*)\b/u.test(text)) {
    return level === "KLEUTER";
  }
  if (/\b(lager onderwijs|leerjaar|\.gl\d*)\b/u.test(text)) {
    return level === "LAGER";
  }

  const phase = text.match(/\bfase\s*([1-4])\b/u)?.[1];
  if (phase) {
    return level === (Number(phase) <= 2 ? "KLEUTER" : "LAGER");
  }

  const ranges = ageRanges(raw);
  if (ranges.length > 0) {
    return ranges.some(([start, end]) =>
      level === "KLEUTER"
        ? start < KLEUTER_MAX_AGE
        : end > LAGER_MIN_AGE && start < LAGER_MAX_AGE,
    );
  }

  return false;
}

export function resultMatchesEducationLevel(
  result: CurriculumSearchResult,
  level: EducationLevelFilter,
): boolean {
  if (level === "ALL") return true;

  const minimumMeta = ahovoksMetaFromGoal(result.gelinktMinimumdoel);
  if (minimumMeta) {
    if (level === "BASISONDERWIJS") {
      return minimumMeta.ijkpunt === "kleuter" ||
        minimumMeta.ijkpunt === "4de" ||
        minimumMeta.ijkpunt === "6de";
    }
    return level === "KLEUTER"
      ? minimumMeta.ijkpunt === "kleuter"
      : level === "LAGER"
        ? minimumMeta.ijkpunt === "4de" || minimumMeta.ijkpunt === "6de"
        : false;
  }

  if (
    level === "SECUNDAIR" &&
    (result.netwerk === "VLAANDEREN" ||
      /\b(?:1ste|2de|3de|eerste|tweede|derde)\s+graad\b|finaliteit|[AB]-stroom/iu.test(
        result.leerjaarRoute,
      ))
  ) {
    return true;
  }

  if (DOMAIN_LEVELS.has(level)) {
    const route = `${result.leerjaarRoute} ${result.discipline} ${result.titel}`.toLocaleLowerCase("nl-BE");
    if (level === "BUBAO") {
      return /\bbubao\b|buitengewoon bas|ontwikkelingsdoel|type\s*\d/u.test(route);
    }
    if (level === "BUSO") {
      return /\bbuso\b|buitengewoon secundair|ov\s*[123]/u.test(route);
    }
    if (level === "OKAN") {
      return /\bokan\b|onthaal|nt2|nieuwkom/u.test(route);
    }
    if (level === "DKO") {
      return /\bdko\b|kunstonderwijs|beeld|muziek|dans/u.test(route);
    }
    if (level === "VOLWASSENEN") {
      return /\bvolwassenen|basiseducatie|cvo/u.test(route);
    }
    if (level === "HOGER") {
      return /\bhoger|lerarenopleiding|dlr|basiscompetentie/u.test(route);
    }
  }

  return recordMatchesEducationLevel(
    {
      onderwijsniveau: result.leerjaarRoute,
      code: result.code,
      graad: result.leerjaarRoute,
      finaliteit: result.leerjaarRoute,
    },
    level,
  );
}
