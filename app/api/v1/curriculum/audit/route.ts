import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-guard";
import { runB2bJob } from "@/lib/b2b/worker";
import { curriculumAuditBodySchema } from "@/lib/b2b/schemas";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = withApiAuth(async (_request, context) => NextResponse.json(
  await runB2bJob("audit", context.body, context.orgId, context.signal),
  { headers: { "Cache-Control": "no-store" } },
), { requiredScope: "curriculum:audit", bodySchema: curriculumAuditBodySchema });
