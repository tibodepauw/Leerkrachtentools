import { z } from "zod";

export const CURRICULUM_MATCH_LIMIT_MIN = 1;
export const CURRICULUM_MATCH_LIMIT_MAX = 10;
export const CURRICULUM_MATCH_LIMIT_DEFAULT = 5;

export const curriculumMatchBodySchema = z.object({
  query: z.string().trim().min(3).max(500),
  network: z.enum(["KOV", "GO", "OVSG", "AHOVOKS"]).default("AHOVOKS"),
  level: z.enum(["basis", "secundair"]).default("basis"),
  grade: z.string().trim().min(1).max(80).optional(),
  mode: z.enum(["snel", "pro"]).default("snel"),
  limit: z
    .number()
    .int()
    .min(CURRICULUM_MATCH_LIMIT_MIN)
    .max(CURRICULUM_MATCH_LIMIT_MAX)
    .default(CURRICULUM_MATCH_LIMIT_DEFAULT),
});

export const curriculumAuditBodySchema = z.object({
  method_title: z.string().trim().min(1).max(200),
  grade: z.string().trim().min(1).max(80),
  target_goals: z.array(z.string().trim().min(1).max(500)).min(1).max(40),
  lesson_units: z
    .array(
      z.object({
        unit_id: z.string().trim().min(1).max(80),
        title: z.string().trim().min(1).max(200),
        content: z.string().trim().min(1).max(8000),
      }),
    )
    .min(1)
    .max(100),
});

export const goalImproveBodySchema = z.object({
  goal: z.string().trim().min(3).max(2000),
});
