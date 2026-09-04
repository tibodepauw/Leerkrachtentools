import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import {
  getUserAiConfig,
  isProviderName,
} from "@/lib/ai/userCredentials";
import { listProviderModels } from "@/lib/ai/listModels";
import type { ProviderName } from "@/lib/ai/providers";
import { publicErrorMessage } from "@/lib/http/clientError";
import { readJsonBody } from "@/lib/http/requestBody";

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const body = (await readJsonBody(request, 16_384)) as {
    provider?: string;
    apiKey?: string;
    cloudflareAccountId?: string;
  };

  if (!isProviderName(body.provider ?? "")) {
    return NextResponse.json(
      { error: "Kies een geldige provider." },
      { status: 400 },
    );
  }
  const provider = body.provider as ProviderName;
  const submittedApiKey =
    typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (submittedApiKey.length > 4_096) {
    return NextResponse.json(
      { error: "De API-key is te lang." },
      { status: 400 },
    );
  }

  const saved = getUserAiConfig(session.id);
  const apiKey =
    submittedApiKey ||
    (saved?.provider === provider &&
    saved.apiKey.trim()
      ? saved.apiKey
      : "");

  if (!apiKey) {
    return NextResponse.json(
      { error: "Vul eerst een API-key in." },
      { status: 400 },
    );
  }

  const cloudflareAccountId =
    typeof body.cloudflareAccountId === "string" &&
    body.cloudflareAccountId.trim()
      ? body.cloudflareAccountId.trim()
      : saved?.cloudflareAccountId;

  if (
    body.provider === "cloudflare" &&
    (!cloudflareAccountId ||
      !/^[a-f0-9]{32}$/iu.test(cloudflareAccountId))
  ) {
    return NextResponse.json(
      { error: "Vul je Cloudflare account ID in." },
      { status: 400 },
    );
  }

  try {
    const models = await listProviderModels(provider, {
      apiKey,
      cloudflareAccountId,
    });
    return NextResponse.json({ models });
  } catch (error) {
    return NextResponse.json(
      {
        error: publicErrorMessage(
          error,
          "Modellen konden niet worden opgehaald.",
        ),
      },
      { status: 400 },
    );
  }
}
