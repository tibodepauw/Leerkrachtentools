import "server-only";

import { getDatabase } from "@/lib/auth/database";
import { decryptSecret } from "@/lib/auth/crypto";
import type { ProviderName } from "@/lib/ai/providers";

export interface UserAiConfig {
  enabled: boolean;
  provider: ProviderName;
  apiKey: string;
  model: string;
  cloudflareAccountId?: string;
}

export interface UserAiSettingsPublic {
  enabled: boolean;
  provider: ProviderName;
  model: string;
  hasApiKey: boolean;
  credentialError: boolean;
  apiKeyHint: string | null;
  cloudflareAccountId: string | null;
}

interface UserAiRow {
  use_own_api_keys: number;
  ai_provider: string | null;
  ai_api_key_enc: string | null;
  ai_model: string | null;
  ai_cloudflare_account_id: string | null;
}

const providers = new Set<ProviderName>([
  "google",
  "groq",
  "cerebras",
  "sambanova",
  "cloudflare",
]);

export function isProviderName(value: string): value is ProviderName {
  return providers.has(value as ProviderName);
}

export function apiKeyEncryptionContext(
  userId: string,
  provider: ProviderName,
) {
  return `user:${userId}:provider:${provider}`;
}

export function getUserAiSettingsPublic(userId: string): UserAiSettingsPublic {
  const row = getDatabase()
    .prepare(
      `SELECT use_own_api_keys, ai_provider, ai_api_key_enc, ai_model,
              ai_cloudflare_account_id
       FROM users WHERE id = ?`,
    )
    .get(userId) as UserAiRow | undefined;

  if (!row) {
    return {
      enabled: false,
      provider: "google",
      model: "",
      hasApiKey: false,
      credentialError: false,
      apiKeyHint: null,
      cloudflareAccountId: null,
    };
  }

  const provider = isProviderName(row.ai_provider ?? "")
    ? (row.ai_provider as ProviderName)
    : "google";
  let apiKeyHint: string | null = null;
  let credentialError = false;
  if (row.ai_api_key_enc) {
    try {
      const decrypted = decryptSecret(
        row.ai_api_key_enc,
        apiKeyEncryptionContext(userId, provider),
      );
      apiKeyHint = decrypted.length <= 4 ? "••••" : `••••${decrypted.slice(-4)}`;
    } catch {
      apiKeyHint = "••••";
      credentialError = true;
    }
  }

  return {
    enabled: Boolean(row.use_own_api_keys),
    provider,
    model: row.ai_model ?? "",
    hasApiKey: Boolean(row.ai_api_key_enc),
    credentialError,
    apiKeyHint,
    cloudflareAccountId: row.ai_cloudflare_account_id,
  };
}

export function getUserAiConfig(userId: string): UserAiConfig | null {
  const row = getDatabase()
    .prepare(
      `SELECT use_own_api_keys, ai_provider, ai_api_key_enc, ai_model,
              ai_cloudflare_account_id
       FROM users WHERE id = ?`,
    )
    .get(userId) as UserAiRow | undefined;

  if (!row?.use_own_api_keys) return null;

  const provider = isProviderName(row.ai_provider ?? "")
    ? (row.ai_provider as ProviderName)
    : "google";
  let apiKey = "";

  if (row.ai_api_key_enc && isProviderName(row.ai_provider ?? "")) {
    try {
      apiKey = decryptSecret(
        row.ai_api_key_enc,
        apiKeyEncryptionContext(userId, provider),
      );
    } catch {
      apiKey = "";
    }
  }

  return {
    enabled: true,
    provider,
    apiKey,
    model: row.ai_model ?? "",
    cloudflareAccountId: row.ai_cloudflare_account_id ?? undefined,
  };
}

export function userAiConfigHasCredentials(config: UserAiConfig) {
  if (!config.enabled || !config.apiKey.trim()) return false;
  if (config.provider === "cloudflare") {
    return Boolean(config.cloudflareAccountId?.trim());
  }
  return true;
}
