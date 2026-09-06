import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-guard";
import { matchCurriculumGoals } from "@/lib/b2b/matchCurriculum";
import { curriculumMatchBodySchema } from "@/lib/b2b/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiAuth(
  async (_request, context) => {
    const input = curriculumMatchBodySchema.parse(context.body);
    const results = await matchCurriculumGoals({
      query: input.query,
      network: input.network,
      level: input.level,
      grade: input.grade,
      mode: input.mode,
      orgId: context.orgId,
    });

    return NextResponse.json(
      {
        success: true,
        count: results.length,
        results,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { requiredScope: "curriculum:match" },
);
