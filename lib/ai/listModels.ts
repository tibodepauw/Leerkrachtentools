import "server-only";

import type { ProviderName } from "@/lib/ai/providers";
import { isUsableChatModelId } from "@/lib/ai/usableModels";
import { externalApiAbortSignal } from "@/lib/http/externalTimeout";

export { defaultModelForProvider } from "@/lib/ai/usableModels";

export interface ListedModel {
  id: string;
  label: string;
}

const cloudflareModels: ListedModel[] = [
  { id: "@cf/meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B Instruct" },
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B Instruct" },
  { id: "@cf/mistral/mistral-small-3.1-24b-instruct", label: "Mistral Small 3.1 24B" },
];

function uniqueModels(models: ListedModel[]) {
  const seen = new Set<string>();
  return models.filter((model) => {
    if (!model.id || seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}

function openAiCompatibleModels(
  provider: Exclude<ProviderName, "google" | "cloudflare">,
  body: { data?: Array<{ id?: string }> },
) {
  return uniqueModels(
    (body.data ?? [])
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .filter((id) => isUsableChatModelId(provider, id))
      .map((id) => ({ id, label: id })),
  );
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
        "https://generativelanguage.googleapis.com/v1beta/models",
        {
          headers: { "x-goog-api-key": apiKey },
          signal: externalApiAbortSignal(),
        },
      );
      if (!response.ok) {
        throw new Error(`Google-modellen konden niet worden opgehaald (${response.status}).`);
      }
      const body = (await response.json()) as {
        models?: Array<{
          name?: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      return uniqueModels(
        (body.models ?? [])
          .filter((model) => {
            const methods = model.supportedGenerationMethods ?? [];
            return (
              methods.length === 0 || methods.includes("generateContent")
            );
          })
          .map((model) => {
            const id = model.name?.replace(/^models\//, "") ?? "";
            return { id, label: model.displayName ?? id };
          })
          .filter(
            (model) =>
              model.id.includes("gemini") &&
              isUsableChatModelId("google", model.id),
          )
          .sort((left, right) => left.label.localeCompare(right.label, "nl")),
      );
    }
    case "groq": {
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: externalApiAbortSignal(),
      });
      if (!response.ok) {
        throw new Error(`Groq-modellen konden niet worden opgehaald (${response.status}).`);
      }
      return openAiCompatibleModels("groq", await response.json());
    }
    case "cerebras": {
      const response = await fetch("https://api.cerebras.ai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: externalApiAbortSignal(),
      });
      if (!response.ok) {
        throw new Error(
          `Cerebras-modellen konden niet worden opgehaald (${response.status}).`,
        );
      }
      return openAiCompatibleModels("cerebras", await response.json());
    }
    case "sambanova": {
      const baseUrl =
        process.env.SAMBANOVA_BASE_URL ?? "https://api.sambanova.ai/v1";
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: externalApiAbortSignal(),
      });
      if (!response.ok) {
        throw new Error(
          `SambaNova-modellen konden niet worden opgehaald (${response.status}).`,
        );
      }
      return openAiCompatibleModels("sambanova", await response.json());
    }
    case "cloudflare":
      return cloudflareModels;
    default:
      return [];
  }
}
