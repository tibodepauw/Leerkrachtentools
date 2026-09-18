import { matchCurriculumGoals } from "@/lib/b2b/matchCurriculum";
import { auditCurriculumCoverage } from "@/lib/b2b/auditCurriculum";
import { improveLessonGoal } from "@/lib/goals/improveGoal";
import { curriculumMatchBodySchema, curriculumAuditBodySchema, goalImproveBodySchema } from "@/lib/b2b/schemas";
import { readJob, writeJob } from "./wire";

async function main() {
  const job = await readJob(70_000) as { task: string; body: unknown; orgId: string };
  if (typeof job.orgId !== "string") throw new Error("invalid organization");
  switch (job.task) {
    case "match": {
      const input = curriculumMatchBodySchema.parse(job.body);
      const result = await matchCurriculumGoals({ ...input, orgId: job.orgId });
      return { success: true, count: result.results.length, ...result };
    }
    case "audit": {
      const input = curriculumAuditBodySchema.parse(job.body);
      const result = await auditCurriculumCoverage({ targetGoals: input.target_goals, lessonUnits: input.lesson_units, grade: input.grade, orgId: job.orgId });
      return { success: true, method_title: input.method_title, grade: input.grade, count: result.coverage.length, ...result };
    }
    case "improve": return { success: true, result: improveLessonGoal(goalImproveBodySchema.parse(job.body).goal) };
    default: throw new Error("unknown operation");
  }
}
main().then((payload) => writeJob({ payload }, 520_000)).catch(() => writeJob({ error: true }, 1000));
