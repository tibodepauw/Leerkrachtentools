import { getGoogleModelId } from "@/lib/ai/googleModel";

export type UsableProvider =
  | "google"
  | "groq"
  | "cerebras"
  | "sambanova"
  | "cloudflare";

const UNUSABLE_MODEL =
  /embedding|imagen|veo|aqa|tts|whisper|lyria|robotics|audio-preview|native-audio|computer-use/i;

export function defaultModelForProvider(provider: UsableProvider) {
  switch (provider) {
    case "google":
      return getGoogleModelId();
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

export function isUsableChatModelId(provider: UsableProvider, id: string) {
  const modelId = id.trim();
  if (!modelId) return false;
  if (UNUSABLE_MODEL.test(modelId)) return false;
  if (provider === "groq" && /guard|playai|distil-whisper/i.test(modelId)) {
    return false;
  }
  return true;
}

export function pickPreferredModelId(
  models: Array<{ id: string }>,
  current: string,
  fallback: string,
) {
  if (current && models.some((model) => model.id === current)) {
    return current;
  }
  if (fallback && models.some((model) => model.id === fallback)) {
    return fallback;
  }
  const lite = models.find((model) => /flash-lite/i.test(model.id));
  if (lite) return lite.id;
  const flash = models.find((model) => /flash/i.test(model.id));
  if (flash) return flash.id;
  return models[0]?.id ?? current;
}
