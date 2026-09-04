import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import {
  apiKeyEncryptionContext,
  getUserAiSettingsPublic,
  isProviderName,
} from "@/lib/ai/userCredentials";
import { getDatabase } from "@/lib/auth/database";
import { encryptSecret } from "@/lib/auth/crypto";
import { defaultModelForProvider } from "@/lib/ai/listModels";
import type { ProviderName } from "@/lib/ai/providers";

export async function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();
  return NextResponse.json(getUserAiSettingsPublic(session.id), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as {
    enabled?: boolean;
    provider?: string;
    model?: string;
    apiKey?: string;
    cloudflareAccountId?: string;
  };

  const current = getUserAiSettingsPublic(session.id);
  if (
    body.provider !== undefined &&
    !isProviderName(body.provider)
  ) {
    return NextResponse.json(
      { error: "Kies een geldige provider." },
      { status: 400 },
    );
  }
  const enabled = body.enabled ?? current.enabled;
  const provider: ProviderName = isProviderName(body.provider ?? "")
    ? (body.provider as ProviderName)
    : current.provider;
  const model =
    typeof body.model === "string"
      ? body.model.trim()
      : current.model || defaultModelForProvider(provider);
  const cloudflareAccountId =
    typeof body.cloudflareAccountId === "string"
      ? body.cloudflareAccountId.trim()
      : current.cloudflareAccountId ?? "";
  const providerChanged = provider !== current.provider;
  const hasNewKey =
    typeof body.apiKey === "string" && Boolean(body.apiKey.trim());

  if (model.length > 200 || /[\p{C}\s?#]/u.test(model)) {
    return NextResponse.json(
      { error: "Kies een geldige modelnaam." },
      { status: 400 },
    );
  }
  if (
    provider === "cloudflare" &&
    cloudflareAccountId &&
    !/^[a-f0-9]{32}$/iu.test(cloudflareAccountId)
  ) {
    return NextResponse.json(
      { error: "Vul een geldig Cloudflare account ID in." },
      { status: 400 },
    );
  }

  if (enabled) {
    if (
      !hasNewKey &&
      (!current.hasApiKey || current.credentialError || providerChanged)
    ) {
      return NextResponse.json(
        {
          error: providerChanged
            ? "Vul een nieuwe API-key in wanneer je van provider wisselt."
            : "Vul een geldige API-key in voordat je eigen keys inschakelt.",
        },
        { status: 400 },
      );
    }
    if (provider === "cloudflare" && !cloudflareAccountId) {
      return NextResponse.json(
        { error: "Vul je Cloudflare account ID in." },
        { status: 400 },
      );
    }
    if (!model) {
      return NextResponse.json(
        { error: "Selecteer een model of haal modellen op via detectie." },
        { status: 400 },
      );
    }
  }

  let apiKeyEnc: string | null = null;
  if (hasNewKey) {
    apiKeyEnc = encryptSecret(
      body.apiKey!.trim(),
      apiKeyEncryptionContext(session.id, provider),
    );
  } else if (
    current.hasApiKey &&
    !current.credentialError &&
    !providerChanged
  ) {
    const row = getDatabase()
      .prepare("SELECT ai_api_key_enc FROM users WHERE id = ?")
      .get(session.id) as { ai_api_key_enc: string | null } | undefined;
    apiKeyEnc = row?.ai_api_key_enc ?? null;
  }

  getDatabase()
    .prepare(
      `UPDATE users SET
         use_own_api_keys = ?,
         ai_provider = ?,
         ai_api_key_enc = ?,
         ai_model = ?,
         ai_cloudflare_account_id = ?,
         updated_at = ?
       WHERE id = ?`,
    )
    .run(
      enabled ? 1 : 0,
      provider,
      enabled ? apiKeyEnc : null,
      enabled ? model : null,
      enabled && provider === "cloudflare" ? cloudflareAccountId : null,
      Date.now(),
      session.id,
    );

  return NextResponse.json(getUserAiSettingsPublic(session.id), {
    headers: { "Cache-Control": "no-store" },
  });
}
