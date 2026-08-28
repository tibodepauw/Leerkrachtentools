import { createCerebras } from "@ai-sdk/cerebras";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

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

export function getModelCandidates(preferred?: ProviderName): ModelCandidate[] {
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
      model: google(process.env.GOOGLE_MODEL ?? "gemini-2.5-flash-lite"),
    });
  }

  if (!preferred) return candidates;
  return candidates.sort((a, b) =>
    a.name === preferred ? -1 : b.name === preferred ? 1 : 0,
  );
}

export function hasCloudflare() {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_API_TOKEN,
  );
}

export function hasAnyAiProvider() {
  return getModelCandidates().length > 0 || hasCloudflare();
}
