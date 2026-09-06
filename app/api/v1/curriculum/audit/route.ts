import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-guard";
import { auditCurriculumCoverage } from "@/lib/b2b/auditCurriculum";
import { curriculumAuditBodySchema } from "@/lib/b2b/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiAuth(
  async (_request, context) => {
    const input = curriculumAuditBodySchema.parse(context.body);
    const report = await auditCurriculumCoverage({
      targetGoals: input.target_goals,
      lessonUnits: input.lesson_units,
      grade: input.grade,
      orgId: context.orgId,
    });

    return NextResponse.json(
      {
        success: true,
        method_title: input.method_title,
        grade: input.grade,
        count: report.coverage.length,
        coverage: report.coverage,
        missing: report.missing,
        undercovered: report.undercovered,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { requiredScope: "curriculum:audit" },
);
