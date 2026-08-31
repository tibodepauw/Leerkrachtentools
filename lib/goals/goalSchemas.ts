import { z } from "zod";
import {
  containsForbiddenVerb,
  findForbiddenVerbs,
  inferGoalDomain,
  type GoalDomain,
  usesDasOpening,
  usesMcOpening,
  validateDasImprovedGoal,
  validateMcImprovedGoal,
} from "@/lib/goals/lessonGoalRules";

export const goalDomainSchema = z.enum(["MC", "DAS", "spreek", "muzisch"]);

export const goalImprovementSchema = z
  .object({
    status: z.enum(["goed", "verbeterd"]),
    original: z.string().min(1),
    improved: z.string().min(1),
    rationale: z.string().min(1),
    goalDomain: goalDomainSchema,
    removedTerms: z.array(z.string()),
    addedTerms: z.array(z.string()),
    criteria: z.array(z.string()),
    splitRecommendation: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "goed" && data.original.trim() !== data.improved.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bij status "goed" moeten original en improved identiek zijn.',
        path: ["improved"],
      });
    }

    if (containsForbiddenVerb(data.improved)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Het verbeterde doel bevat verboden werkwoorden: ${findForbiddenVerbs(data.improved).join(", ")}.`,
        path: ["improved"],
      });
    }

    if (data.goalDomain === "MC" && !usesMcOpening(data.improved)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'MC-doelen moeten starten met "De leerlingen kunnen..." volgens de Thomas More-regels voor een goed lesdoel.',
        path: ["improved"],
      });
    }

    if (data.goalDomain === "DAS" && !usesDasOpening(data.improved)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'DAS-doelen mogen geen "kunnen" gebruiken; start met durven/willen/zijn bereid om/tonen interesse voor/beleven plezier aan/...',
        path: ["improved"],
      });
    }

    if (data.goalDomain === "DAS" && /\bde\s+leerlingen\s+kunnen\b/iu.test(data.improved)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DAS-doelen mogen het werkwoord "kunnen" niet bevatten.',
        path: ["improved"],
      });
    }

    if (
      (data.goalDomain === "spreek" || data.goalDomain === "muzisch") &&
      containsForbiddenVerb(data.improved)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Gematigd open doelen mogen geen verboden werkwoorden bevatten.",
        path: ["improved"],
      });
    }
  });

export const goalTaxonomySchema = z.object({
  original: z.string().min(1),
  taxonomy: z.enum(["MC", "DAS", "SPM"]),
  subcategory: z.string().min(1),
  behaviorLevel: z.string().min(1),
  rationale: z.string().min(1),
  indicators: z.array(z.string()).min(1).max(8),
  definition: z.string().min(1),
});

export function inferGoalDomainFromText(text: string): GoalDomain {
  return inferGoalDomain(text);
}

export function passesImprovedGoalChecks(
  improved: string,
  goalDomain: GoalDomain,
) {
  if (containsForbiddenVerb(improved)) return false;
  if (goalDomain === "MC") return validateMcImprovedGoal(improved);
  if (goalDomain === "DAS") return validateDasImprovedGoal(improved);
  return true;
}
