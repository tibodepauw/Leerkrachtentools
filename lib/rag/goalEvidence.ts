import { countCurriculumTokenMatches, tokenizeCurriculumQuery } from "@/lib/rag/curriculumQueryTokens";

export type GoalEvidence = { leeftijd: string; tekst: string };

/** Bounded, literal source excerpts for a broad goal's matching development steps. */
export function selectGoalEvidence(raw: Record<string, unknown>, query: string): GoalEvidence[] {
  if (!Array.isArray(raw.leerlijn)) return [];
  const tokens = tokenizeCurriculumQuery(query);
  const seen = new Set<string>();
  const matches: Array<GoalEvidence & { score: number }> = [];
  for (const line of raw.leerlijn) {
    if (!line || typeof line !== "object" || !Array.isArray(line.ontwikkelstappen)) continue;
    const leeftijd = typeof line.leeftijd === "string" ? line.leeftijd.slice(0, 60) : "";
    for (const step of line.ontwikkelstappen) {
      if (typeof step !== "string" || !step.trim()) continue;
      const identity = `${leeftijd}|${step.trim()}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const score = countCurriculumTokenMatches(step, tokens, query);
      if (score > 0) matches.push({
        leeftijd,
        tekst: step.trim().slice(0, 600),
        score,
      });
    }
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 2)
    .map(({ leeftijd, tekst }) => ({ leeftijd, tekst }));
}
