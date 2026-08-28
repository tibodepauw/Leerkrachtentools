import { z } from "zod";

export const manualExtractionSchema = z.object({
  learningArea: z.string(),
  component: z.string(),
  topic: z.string(),
  targetGroup: z.string(),
  materials: z.array(z.string()),
  rawPublisherGoals: z.array(z.string()).max(12),
});

export const goalImprovementSchema = z.object({
  original: z.string(),
  improved: z.string(),
  rationale: z.string(),
  removedTerms: z.array(z.string()),
  addedTerms: z.array(z.string()),
  criteria: z.array(z.string()),
});

export const goalTaxonomySchema = z.object({
  original: z.string(),
  taxonomy: z.enum(["MC", "DAS", "SPM"]),
  rationale: z.string(),
  indicators: z.array(z.string()),
  definition: z.string(),
});

export const goalAnalysisSchema = goalImprovementSchema.extend({
  taxonomy: z.enum(["MC", "DAS", "SPM"]),
});

export const dialogueSchema = z.object({
  formatted: z.string(),
  interventions: z.number(),
});

export const spellcheckSchema = z.object({
  improved: z.string(),
  issues: z
    .array(
      z.object({
        original: z.string(),
        replacement: z.string(),
        reason: z.string(),
      }),
    )
    .max(50),
});

export const timingAdviceSchema = z.object({
  suggestions: z.array(z.string()).min(1).max(4),
  rationale: z.string(),
});

export const alignmentSchema = z.object({
  rows: z.array(
    z.object({
      goal: z.string(),
      instruction: z.enum(["gedekt", "gedeeltelijk", "ontbreekt"]),
      practice: z.enum(["gedekt", "gedeeltelijk", "ontbreekt"]),
      evaluation: z.enum(["gedekt", "gedeeltelijk", "ontbreekt"]),
      advice: z.string(),
    }),
  ),
});

export const engagementSchema = z.object({
  factors: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["aanwezig", "gedeeltelijk", "ontbreekt"]),
      evidence: z.string(),
      suggestion: z.string(),
    }),
  ),
});

export const fullAuditSchema = z.object({
  score: z.number().min(0).max(100),
  criteria: z.array(
    z.object({
      label: z.string(),
      status: z.enum(["groen", "oranje", "rood"]),
      finding: z.string(),
      improvement: z.string(),
    }),
  ),
});

export const reflectionSchema = z.object({
  goals: z.array(
    z.object({
      id: z.string(),
      reach: z.enum(["meerderheid", "minderheid", "onbekend"]),
      evidence: z.string(),
    }),
  ),
  engagement: z.array(
    z.object({ factor: z.string(), evaluation: z.string() }),
  ),
  teacherIdentity: z.string(),
  followUpQuestions: z.array(z.string()).max(2),
});
