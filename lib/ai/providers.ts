import { createCerebras } from "@ai-sdk/cerebras";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { UserAiConfig } from "@/lib/ai/userCredentials";
import { userAiConfigHasCredentials } from "@/lib/ai/userCredentials";
import { defaultModelForProvider } from "@/lib/ai/listModels";
import { getGoogleModelId } from "@/lib/ai/googleModel";

export type ProviderName =
  | "google"
  | "groq"
  | "cerebras"
  | "sambanova"
  | "cloudflare";

export interface ModelCandidate {
  name: ProviderName;
  model: LanguageModel;
}

function envModelCandidates(preferred?: ProviderName): ModelCandidate[] {
  const candidates: ModelCandidate[] = [];

  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    candidates.push({
      name: "groq",
      model: groq(process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"),
    });
  }

  if (process.env.CEREBRAS_API_KEY) {
    const cerebras = createCerebras({
      apiKey: process.env.CEREBRAS_API_KEY,
    });
    candidates.push({
      name: "cerebras",
      model: cerebras(process.env.CEREBRAS_MODEL ?? "llama3.1-8b"),
    });
  }

  if (process.env.SAMBANOVA_API_KEY) {
    const sambanova = createOpenAI({
      name: "sambanova",
      apiKey: process.env.SAMBANOVA_API_KEY,
      baseURL:
        process.env.SAMBANOVA_BASE_URL ?? "https://api.sambanova.ai/v1",
    });
    candidates.push({
      name: "sambanova",
      model: sambanova.chat(
        process.env.SAMBANOVA_MODEL ?? "Meta-Llama-3.3-70B-Instruct",
      ),
    });
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    candidates.push({
      name: "google",
      model: google(getGoogleModelId()),
    });
  }

  if (!preferred) return candidates;
  return candidates.sort((a, b) =>
    a.name === preferred ? -1 : b.name === preferred ? 1 : 0,
  );
}

function userModelCandidates(
  config: UserAiConfig,
  preferred?: ProviderName,
): ModelCandidate[] {
  const modelId =
    config.model.trim() || defaultModelForProvider(config.provider);

  let candidate: ModelCandidate | null = null;

  switch (config.provider) {
    case "groq":
      candidate = {
        name: "groq",
        model: createGroq({ apiKey: config.apiKey })(modelId),
      };
      break;
    case "cerebras":
      candidate = {
        name: "cerebras",
        model: createCerebras({ apiKey: config.apiKey })(modelId),
      };
      break;
    case "sambanova":
      candidate = {
        name: "sambanova",
        model: createOpenAI({
          name: "sambanova",
          apiKey: config.apiKey,
          baseURL:
            process.env.SAMBANOVA_BASE_URL ?? "https://api.sambanova.ai/v1",
        }).chat(modelId),
      };
      break;
    case "google":
      candidate = {
        name: "google",
        model: createGoogleGenerativeAI({ apiKey: config.apiKey })(modelId),
      };
      break;
    case "cloudflare":
      return [];
  }

  if (!candidate) return [];
  if (!preferred || preferred === candidate.name) return [candidate];
  return [candidate];
}

export function getModelCandidates(
  preferred?: ProviderName,
  userConfig?: UserAiConfig | null,
) {
  if (userConfig?.enabled) {
    return userAiConfigHasCredentials(userConfig)
      ? userModelCandidates(userConfig, preferred)
      : [];
  }
  return envModelCandidates(preferred);
}

export function hasCloudflare(userConfig?: UserAiConfig | null) {
  if (userConfig?.enabled) {
    return (
      userConfig.provider === "cloudflare" &&
      userAiConfigHasCredentials(userConfig)
    );
  }
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN,
  );
}

export function cloudflareCredentials(userConfig?: UserAiConfig | null) {
  if (userConfig?.enabled && userConfig.provider === "cloudflare") {
    return {
      accountId: userConfig.cloudflareAccountId ?? "",
      token: userConfig.apiKey,
      model:
        userConfig.model.trim() ||
        defaultModelForProvider("cloudflare"),
    };
  }
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    token: process.env.CLOUDFLARE_API_TOKEN ?? "",
    model: process.env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.1-8b-instruct",
  };
}

export function hasAnyAiProvider(userConfig?: UserAiConfig | null) {
  return getModelCandidates(undefined, userConfig).length > 0 || hasCloudflare(userConfig);
}
