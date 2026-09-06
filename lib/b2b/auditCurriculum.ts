import { tokenize, scoreTextOverlap } from "@/lib/rag/curriculumCorpus";
import { matchCurriculumGoals } from "@/lib/b2b/matchCurriculum";
import type { PublisherLevel } from "@/lib/b2b/publisherNetwork";

export type CurriculumAuditUnit = {
  unit_id: string;
  title: string;
  content: string;
};

export type CurriculumAuditCoverage = {
  goal: string;
  status: "gedekt" | "gedeeltelijk" | "ontbreekt";
  matched_units: string[];
  linked_curriculum?: {
    code: string;
    text: string;
    network: string;
    score: number;
  };
  advice: string;
};

function coverageStatus(score: number): CurriculumAuditCoverage["status"] {
  if (score >= 0.42) return "gedekt";
  if (score >= 0.18) return "gedeeltelijk";
  return "ontbreekt";
}

function adviceForStatus(
  status: CurriculumAuditCoverage["status"],
  goal: string,
) {
  if (status === "gedekt") {
    return "Dit doel komt in de lesunits voldoende terug. Maak het succescriterium in de afronding zichtbaar.";
  }
  if (status === "gedeeltelijk") {
    return `Versterk instructie of verwerking zodat “${goal.slice(0, 80)}” observeerbaar geoefend wordt.`;
  }
  return `Dit doel ontbreekt in de lesunits. Voorzie een gerichte activiteit of evaluatie.`;
}

export async function auditCurriculumCoverage({
  targetGoals,
  lessonUnits,
  grade,
  orgId,
}: {
  targetGoals: string[];
  lessonUnits: CurriculumAuditUnit[];
  grade: string;
  orgId: string;
}): Promise<{
  coverage: CurriculumAuditCoverage[];
  missing: string[];
  undercovered: string[];
}> {
  const coverage: CurriculumAuditCoverage[] = [];

  for (const goal of targetGoals) {
    const tokens = new Set(
      [...tokenize(goal)].filter((token) => token.length >= 4),
    );
    const matchedUnits: Array<{ id: string; score: number }> = [];

    for (const unit of lessonUnits) {
      const haystack = `${unit.title}\n${unit.content}`;
      const score = scoreTextOverlap(haystack, tokens);
      if (score >= 0.12) {
        matchedUnits.push({ id: unit.unit_id, score });
      }
    }

    const bestUnitScore = matchedUnits.reduce(
      (highest, unit) => Math.max(highest, unit.score),
      0,
    );
    const status = coverageStatus(bestUnitScore);
    const linked = (
      await matchCurriculumGoals({
        query: goal,
        network: "AHOVOKS",
        level: inferPublisherLevel(grade),
        grade,
        mode: "snel",
        orgId,
      })
    )[0];

    coverage.push({
      goal,
      status,
      matched_units: matchedUnits
        .sort((left, right) => right.score - left.score)
        .map((unit) => unit.id),
      ...(linked
        ? {
            linked_curriculum: {
              code: linked.code,
              text: linked.text,
              network: linked.network,
              score: linked.score,
            },
          }
        : {}),
      advice: adviceForStatus(status, goal),
    });
  }

  return {
    coverage,
    missing: coverage
      .filter((item) => item.status === "ontbreekt")
      .map((item) => item.goal),
    undercovered: coverage
      .filter((item) => item.status === "gedeeltelijk")
      .map((item) => item.goal),
  };
}

export function inferPublisherLevel(grade: string): PublisherLevel {
  return /secundair|graad|aso|bso|kso|tso/i.test(grade) ? "secundair" : "basis";
}
