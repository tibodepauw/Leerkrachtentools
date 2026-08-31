import {
  collapseDoubleGoalVerbs,
  containsForbiddenVerb,
  findForbiddenVerbs,
  hasDoubleGoalWording,
  inferGoalDomain,
  isContentGoal,
  isLearningProcessGoal,
  isTeacherActivityGoal,
  openGoalChecklist,
  replaceForbiddenVerbs,
  type GoalDomain,
} from "@/lib/goals/lessonGoalRules";

const CRITERIA_PATTERN =
  /\b(minstens|ten minste|maximaal|correct|zelfstandig|aan de hand van|met behulp van|in groep|individueel|steeds)\b/iu;

function capitalizeFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeWhitespace(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function normalizeMcSubject(text: string) {
  let normalized = normalizeWhitespace(text);

  if (/^de leerlingen kunnen\b/iu.test(normalized)) {
    return capitalizeFirst(normalized);
  }

  if (/^de leerlingen\b/iu.test(normalized)) {
    return normalized.replace(/^de leerlingen\b/iu, "De leerlingen kunnen");
  }

  if (/^de leerling\b/iu.test(normalized)) {
    return normalized.replace(/^de leerling\b/iu, "De leerlingen kunnen");
  }

  if (/^leerling(?:en)?\b/iu.test(normalized)) {
    return normalized.replace(/^leerling(?:en)?\b/iu, "De leerlingen kunnen");
  }

  const lowerFirst =
    normalized.charAt(0).toLocaleLowerCase("nl-BE") + normalized.slice(1);
  return `De leerlingen kunnen ${lowerFirst}`;
}

function normalizeDasSubject(text: string) {
  let normalized = normalizeWhitespace(text);
  normalized = normalized.replace(/\bde\s+leerlingen\s+kunnen\b/giu, "De leerlingen");

  if (/^de leerlingen\b/iu.test(normalized)) {
    return capitalizeFirst(normalized);
  }

  return `De leerlingen tonen respect voor ${normalized.charAt(0).toLocaleLowerCase("nl-BE")}${normalized.slice(1)}`;
}

function isAlreadyGoodGoal(text: string, goalDomain: GoalDomain) {
  if (containsForbiddenVerb(text)) return false;
  if (hasDoubleGoalWording(text)) return false;
  if (isTeacherActivityGoal(text) || isContentGoal(text) || isLearningProcessGoal(text)) {
    return false;
  }

  if (goalDomain === "MC") {
    return /^De leerlingen kunnen\b/u.test(text) && !containsForbiddenVerb(text);
  }

  if (goalDomain === "DAS") {
    return (
      /\bde leerlingen\s+(?:durven|willen|zijn bereid om|beleven plezier aan|tonen interesse voor|zijn)\b/iu.test(
        text,
      ) && !/\bkunnen\b/iu.test(text)
    );
  }

  return !containsForbiddenVerb(text);
}

export function extractGoalCriteria(text: string) {
  const criteria: string[] = [];
  if (/\bminstens\b/iu.test(text)) criteria.push("minstens");
  if (/\bcorrect\b/iu.test(text)) criteria.push("correct");
  if (/\baan de hand van\b/iu.test(text)) criteria.push("met bron of voorbeeld");
  if (/\bzelfstandig\b/iu.test(text)) criteria.push("zelfstandig");
  if (criteria.length === 0) criteria.push("observeerbaar leerlinggedrag");
  return criteria;
}

function buildIssueRationale(
  goalDomain: GoalDomain,
  issues: string[],
  splitRecommendation?: string,
) {
  const parts = [...issues];
  if (splitRecommendation) parts.push(splitRecommendation);
  if (goalDomain === "spreek" || goalDomain === "muzisch") {
    parts.push(
      goalDomain === "spreek"
        ? "Controleer Wat, Voor wie, Hoe en Waarom in het spreekdoel."
        : "Controleer Rond, Met en Aan in het muzisch doel.",
    );
  }
  return parts.join(" ");
}

function rewriteTeacherGoal(text: string) {
  const match = text.match(
    /de\s+leerkracht\s+(?:laat|vraagt|geeft|toont|bespre(?:ek|ekt)|leert)\s+(?:de\s+)?leerlingen\s+(?:om\s+te\s+)?(.+)/iu,
  );
  if (match?.[1]) {
    return `De leerlingen kunnen ${match[1].trim()}`;
  }
  return "De leerlingen kunnen het doel observeerbaar uitvoeren in de les";
}

export function improveLessonGoal(original: string) {
  const trimmed = normalizeWhitespace(original);
  const goalDomain = inferGoalDomain(trimmed);
  const removedTerms: string[] = [];
  const addedTerms: string[] = [];
  const issues: string[] = [];
  let splitRecommendation: string | undefined;

  if (isTeacherActivityGoal(trimmed)) {
    issues.push("Het doel beschrijft leerkrachtgedrag in plaats van leerlinggedrag.");
  }
  if (isContentGoal(trimmed)) {
    issues.push("Het doel formuleert leerstof in plaats van observeerbaar leerlinggedrag.");
  }
  if (isLearningProcessGoal(trimmed)) {
    issues.push(
      "Het doel beschrijft een leerproces of werkvorm in plaats van getoetste leerinhoud.",
    );
  }

  if (isAlreadyGoodGoal(trimmed, goalDomain) && issues.length === 0) {
    return {
      status: "goed" as const,
      original: trimmed,
      improved: trimmed,
      rationale:
        "Dit doel voldoet aan de Thomas More-regels voor een goed lesdoel: observeerbaar leerlinggedrag, passende aanhef en geen verboden werkwoorden.",
      goalDomain,
      removedTerms,
      addedTerms,
      criteria: extractGoalCriteria(trimmed),
      splitRecommendation,
    };
  }

  let improved =
    goalDomain === "DAS" ? normalizeDasSubject(trimmed) : normalizeMcSubject(trimmed);

  if (isTeacherActivityGoal(trimmed)) {
    improved = rewriteTeacherGoal(trimmed);
    addedTerms.push("De leerlingen kunnen");
  } else if (/^De leerlingen kunnen\b/u.test(improved) && !/^De leerlingen kunnen\b/u.test(trimmed)) {
    addedTerms.push("De leerlingen kunnen");
  }

  const verbFix = replaceForbiddenVerbs(improved);
  improved = verbFix.text;
  removedTerms.push(...verbFix.removedTerms);
  addedTerms.push(...verbFix.addedTerms);

  if (hasDoubleGoalWording(improved)) {
    splitRecommendation =
      "Split dit doel in twee aparte doelen of behoud enkel het hoogste gedragsniveau.";
    improved = collapseDoubleGoalVerbs(improved);
    issues.push("Er stonden twee handelingen in één doel.");
  }

  if (goalDomain === "MC" && !/\bde leerlingen kunnen\b/iu.test(improved)) {
    improved = normalizeMcSubject(improved);
    addedTerms.push("kunnen");
  }

  if (goalDomain === "DAS") {
    improved = improved.replace(/\bde\s+leerlingen\s+kunnen\b/giu, "De leerlingen tonen");
    if (!/\bde leerlingen\s+(?:durven|willen|zijn bereid om|tonen)\b/iu.test(improved)) {
      improved = improved.replace(/^De leerlingen\b/iu, "De leerlingen tonen");
      addedTerms.push("tonen");
    }
  }

  if (goalDomain === "MC" && !CRITERIA_PATTERN.test(improved)) {
    improved = `${improved.replace(/[.!?]\s*$/u, "")} aan de hand van concrete voorbeelden in de les.`;
    addedTerms.push("aan de hand van concrete voorbeelden");
  }

  const openChecks = openGoalChecklist(goalDomain, improved);
  if (openChecks && goalDomain === "spreek") {
    const missing = Object.entries({
      Wat: openChecks.wat,
      "Voor wie": openChecks.voorWie,
      Hoe: openChecks.hoe,
      Waarom: openChecks.waarom,
    })
      .filter(([, present]) => !present)
      .map(([label]) => label);
    if (missing.length > 0) {
      issues.push(`Spreekdoel mist expliciet: ${missing.join(", ")}.`);
    }
  }

  if (openChecks && goalDomain === "muzisch") {
    const missing = Object.entries({
      Rond: openChecks.rond,
      Met: openChecks.met,
      Aan: openChecks.aan,
    })
      .filter(([, present]) => !present)
      .map(([label]) => label);
    if (missing.length > 0) {
      issues.push(`Muzisch doel mist expliciet: ${missing.join(", ")}.`);
    }
  }

  if (!/[.!?]\s*$/u.test(improved)) {
    improved += ".";
  }

  const remainingForbidden = findForbiddenVerbs(improved);
  removedTerms.push(...remainingForbidden.filter((term) => !removedTerms.includes(term)));

  return {
    status: "verbeterd" as const,
    original: trimmed,
    improved,
    rationale: buildIssueRationale(goalDomain, issues, splitRecommendation) ||
      "Het doel werd herschreven volgens de Thomas More-regels voor een goed lesdoel: observeerbaar leerlinggedrag, passende aanhef, verboden werkwoorden verwijderd.",
    goalDomain,
    removedTerms: [...new Set(removedTerms)],
    addedTerms: [...new Set(addedTerms)],
    criteria: extractGoalCriteria(improved),
    splitRecommendation,
  };
}
