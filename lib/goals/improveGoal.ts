const VAGUE_VERBS: Array<{
  pattern: RegExp;
  replacement: string;
  term: string;
}> = [
  { pattern: /\b(kennen|kent)\b/giu, replacement: "herkennen en benoemen", term: "kennen" },
  { pattern: /\b(begrijpen|begrijpt)\b/giu, replacement: "uitleggen", term: "begrijpen" },
  { pattern: /\b(weten|weet)\b/giu, replacement: "benoemen", term: "weten" },
  { pattern: /\binsicht hebben\b/giu, replacement: "toelichten", term: "inzicht hebben" },
  { pattern: /\b(lere?n)\b/giu, replacement: "toepassen", term: "leren" },
];

const CRITERIA_PATTERN =
  /\b(minstens|ten minste|maximaal|correct|zelfstandig|aan de hand van|met behulp van|in groep|individueel|steeds|minstens \d+|ten minste \d+)\b/iu;

function normalizeSubject(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");

  if (/^de leerlingen\b/iu.test(normalized)) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  if (/^de leerling\b/iu.test(normalized)) {
    return normalized.replace(/^de leerling\b/iu, "De leerlingen");
  }

  if (/^leerling(?:en)?\b/iu.test(normalized)) {
    return normalized.replace(/^leerling(?:en)?\b/iu, "De leerlingen");
  }

  if (/^de leerlingen\b/iu.test(normalized)) {
    return normalized;
  }

  const lowerFirst =
    normalized.charAt(0).toLocaleLowerCase("nl-BE") + normalized.slice(1);
  return `De leerlingen ${lowerFirst}`;
}

function ensureModalVerb(text: string, addedTerms: string[]) {
  let next = text.replace(/\bDe leerlingen kan\b/iu, "De leerlingen kunnen");
  if (next !== text) addedTerms.push("kunnen");

  if (/\bde leerlingen kunnen\b/iu.test(next)) return next;

  next = next.replace(/\bDe leerlingen\s+/iu, "De leerlingen kunnen ");
  if (next !== text) addedTerms.push("kunnen");
  return next;
}

function ensureCriteria(text: string, addedTerms: string[]) {
  if (CRITERIA_PATTERN.test(text)) return text;

  const trimmed = text.replace(/[.!?]\s*$/u, "");
  addedTerms.push("aan de hand van concrete voorbeelden");
  return `${trimmed} aan de hand van concrete voorbeelden in de les.`;
}

export function extractGoalCriteria(text: string) {
  const criteria: string[] = [];
  if (/\bminstens\b/iu.test(text)) criteria.push("minstens");
  if (/\bcorrect\b/iu.test(text)) criteria.push("correct");
  if (/\baan de hand van\b/iu.test(text)) criteria.push("met bron of voorbeeld");
  if (/\bzelfstandig\b/iu.test(text)) criteria.push("zelfstandig");
  if (criteria.length === 0) criteria.push("observeerbaar gedrag");
  return criteria;
}

export function improveLessonGoal(original: string) {
  const trimmed = original.trim();
  const removedTerms: string[] = [];
  const addedTerms: string[] = [];

  let improved = normalizeSubject(trimmed);
  if (/^De leerlingen\b/u.test(improved) && !/^De leerlingen\b/u.test(trimmed)) {
    addedTerms.push("De leerlingen");
  }

  for (const rule of VAGUE_VERBS) {
    if (rule.pattern.test(improved)) {
      removedTerms.push(rule.term);
      improved = improved.replace(rule.pattern, rule.replacement);
      if (!addedTerms.includes(rule.replacement)) {
        addedTerms.push(rule.replacement);
      }
    }
  }

  improved = ensureModalVerb(improved, addedTerms);
  improved = ensureCriteria(improved, addedTerms);

  if (!/[.!?]\s*$/u.test(improved)) {
    improved += ".";
  }

  return {
    original: trimmed,
    improved,
    rationale:
      "Het onderwerp van het doel bleef behouden. Vage werkwoorden werden vervangen en het doel kreeg een observeerbare formulering met 'De leerlingen kunnen'.",
    removedTerms,
    addedTerms,
    criteria: extractGoalCriteria(improved),
  };
}
