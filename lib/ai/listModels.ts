import "server-only";

import type { ProviderName } from "@/lib/ai/providers";

export interface ListedModel {
  id: string;
  label: string;
}

const cloudflareModels: ListedModel[] = [
  { id: "@cf/meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B Instruct" },
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B Instruct" },
  { id: "@cf/mistral/mistral-small-3.1-24b-instruct", label: "Mistral Small 3.1 24B" },
];

function openAiCompatibleModels(
  body: { data?: Array<{ id?: string }> },
  filter?: (id: string) => boolean,
) {
  return (body.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .filter((id) => (filter ? filter(id) : true))
    .map((id) => ({ id, label: id }));
}

export async function listProviderModels(
  provider: ProviderName,
  credentials: {
    apiKey: string;
    cloudflareAccountId?: string;
  },
): Promise<ListedModel[]> {
  const { apiKey } = credentials;

  switch (provider) {
    case "google": {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(20_000) },
      );
      if (!response.ok) {
        throw new Error(`Google-modellen konden niet worden opgehaald (${response.status}).`);
      }
      const body = (await response.json()) as {
        models?: Array<{ name?: string; displayName?: string }>;
      };
      return (body.models ?? [])
        .map((model) => {
          const id = model.name?.replace(/^models\//, "") ?? "";
          return { id, label: model.displayName ?? id };
        })
        .filter((model) => model.id.includes("gemini"))
        .sort((left, right) => left.label.localeCompare(right.label, "nl"));
    }
    case "groq": {
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new Error(`Groq-modellen konden niet worden opgehaald (${response.status}).`);
      }
      return openAiCompatibleModels(await response.json());
    }
    case "cerebras": {
      const response = await fetch("https://api.cerebras.ai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new Error(
          `Cerebras-modellen konden niet worden opgehaald (${response.status}).`,
        );
      }
      return openAiCompatibleModels(await response.json());
    }
    case "sambanova": {
      const baseUrl =
        process.env.SAMBANOVA_BASE_URL ?? "https://api.sambanova.ai/v1";
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new Error(
          `SambaNova-modellen konden niet worden opgehaald (${response.status}).`,
        );
      }
      return openAiCompatibleModels(await response.json());
    }
    case "cloudflare":
      return cloudflareModels;
    default:
      return [];
  }
}

export function defaultModelForProvider(provider: ProviderName) {
  switch (provider) {
    case "google":
      return "gemini-2.5-flash-lite";
    case "groq":
      return "llama-3.3-70b-versatile";
    case "cerebras":
      return "llama3.1-8b";
    case "sambanova":
      return "Meta-Llama-3.3-70B-Instruct";
    case "cloudflare":
      return "@cf/meta/llama-3.1-8b-instruct";
  }
}
