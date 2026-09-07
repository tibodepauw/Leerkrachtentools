import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-guard";
import { improveLessonGoal } from "@/lib/goals/improveGoal";
import { goalImproveBodySchema } from "@/lib/b2b/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiAuth(
  async (_request, context) => {
    const input = goalImproveBodySchema.parse(context.body);
    const result = improveLessonGoal(input.goal);

    return NextResponse.json(
      {
        success: true,
        result,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { requiredScope: "goals:improve", bodySchema: goalImproveBodySchema },
);
