import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import {
  searchCurriculum,
} from "@/lib/rag/vectorSearch";
import type { CurriculumGoal, EducationNetwork } from "@/types";

const networks = new Set(["ZILL", "OVSG", "GO"]);
const MATCH_THRESHOLD = 0.08;

export async function POST(request: Request) {
  if (!sessionFromRequest(request)) return unauthorizedResponse();
  try {
    const body = (await request.json()) as {
      goal?: string;
      network?: EducationNetwork;
      schoolYear?: string;
      source?: CurriculumGoal["source"];
    };
    if (!body.goal?.trim()) {
      return NextResponse.json(
        { error: "Vul eerst een lesdoel in." },
        { status: 400 },
      );
    }
    if (
      body.source !== "minimumdoel" &&
      body.source !== "leerplandoel"
    ) {
      return NextResponse.json(
        { error: "Selecteer minimumdoelen of leerplandoelen." },
        { status: 400 },
      );
    }
    if (
      body.source === "leerplandoel" &&
      (!body.network || !networks.has(body.network))
    ) {
      return NextResponse.json(
        { error: "Selecteer een geldig onderwijsnet." },
        { status: 400 },
      );
    }
    const schoolYear = body.schoolYear || "2025-2026";
    const matches = searchCurriculum({
      query: body.goal,
      schoolYear,
      source: body.source,
      network: body.network,
      limit: 3,
    });
    const match =
      matches[0]?.score >= MATCH_THRESHOLD ? matches[0] : null;
    const alternatives = matches
      .slice(1)
      .filter((item) => item.score >= MATCH_THRESHOLD)
      .map((item) => ({ ...item.goal, score: item.score }));

    return NextResponse.json({
      data: {
        goal: match
          ? { ...match.goal, score: match.score }
          : "niet gevonden",
        alternatives,
        corpusNotice:
          body.source === "minimumdoel"
            ? "Alleen geïndexeerde minimumdoelen (retrieval). Geen AI-generatie. Controleer code, leerjaar en officiële bron vóór indiening."
            : body.network === "OVSG"
            ? "Alleen geïndexeerde leerplandoelen (retrieval). OVSG-seed bevat publiek verifieerbare inhoud; importeer LeerLokaal-export voor volledige codes."
            : "Alleen geïndexeerde leerplandoelen (retrieval). Geen AI-generatie. Controleer code en officiële bron vóór indiening.",
        retrievalMode: "indexed-only",
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
            : "Doelenzoekopdracht mislukt.",
      },
      { status: 400 },
    );
  }
}
