import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import {
  futureCurriculum,
  searchCurriculum,
} from "@/lib/rag/vectorSearch";
import type { EducationNetwork } from "@/types";

const networks = new Set(["ZILL", "OVSG", "GO"]);
const MATCH_THRESHOLD = 0.08;

export async function POST(request: Request) {
  if (!sessionFromRequest(request)) return unauthorizedResponse();
  try {
    const body = (await request.json()) as {
      goal?: string;
      network?: EducationNetwork;
      schoolYear?: string;
    };
    if (!body.goal?.trim()) {
      return NextResponse.json(
        { error: "Vul eerst een lesdoel in." },
        { status: 400 },
      );
    }
    if (!body.network || !networks.has(body.network)) {
      return NextResponse.json(
        { error: "Selecteer een geldig onderwijsnet." },
        { status: 400 },
      );
    }
    const schoolYear = body.schoolYear || "2025-2026";
    const minimum = searchCurriculum({
      query: body.goal,
      schoolYear,
      source: "minimumdoel",
      limit: 3,
    });
    const curriculum = searchCurriculum({
      query: body.goal,
      schoolYear,
      source: "leerplandoel",
      network: body.network,
      limit: 3,
    });
    const minimumMatch =
      minimum[0]?.score >= MATCH_THRESHOLD ? minimum[0] : null;
    const curriculumMatch =
      curriculum[0]?.score >= MATCH_THRESHOLD ? curriculum[0] : null;

    return NextResponse.json({
      data: {
        minimumGoal: minimumMatch
          ? { ...minimumMatch.goal, score: minimumMatch.score }
          : "niet gevonden",
        curriculumGoal: curriculumMatch
          ? { ...curriculumMatch.goal, score: curriculumMatch.score }
          : "niet gevonden",
        alternatives: {
          minimum: minimum.slice(1),
          curriculum: curriculum.slice(1),
        },
        futurePlans: futureCurriculum(body.network).map((goal) => ({
          code: goal.code,
          version: goal.version,
          approvalStatus: goal.approvalStatus,
          sourceUrl: goal.sourceUrl,
        })),
        mode: "lokale vectorindex",
        corpusNotice:
          body.network === "OVSG"
            ? "De OVSG-seed bevat alleen publiek verifieerbare inhoud. Importeer een toegestane LeerLokaal-export voor volledige doelcodes."
            : "Lokale bronseed; controleer officiële bron en versie voor indiening.",
      },
      provider: "local",
      fallbackErrors: [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Curriculumzoekopdracht mislukt.",
      },
      { status: 400 },
    );
  }
}
