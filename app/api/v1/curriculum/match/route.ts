import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-guard";
import { matchCurriculumGoals } from "@/lib/b2b/matchCurriculum";
import { curriculumMatchBodySchema } from "@/lib/b2b/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiAuth(
  async (_request, context) => {
    const input = curriculumMatchBodySchema.parse(context.body);
    const matched = await matchCurriculumGoals({
      query: input.query,
      network: input.network,
      level: input.level,
      grade: input.grade,
      mode: input.mode,
      limit: input.limit,
      orgId: context.orgId,
    });

    return NextResponse.json(
      {
        success: true,
        count: matched.results.length,
        results: matched.results,
        requestedMode: matched.requestedMode,
        executedMode: matched.executedMode,
        proFallback: matched.proFallback,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { requiredScope: "curriculum:match", bodySchema: curriculumMatchBodySchema },
);
