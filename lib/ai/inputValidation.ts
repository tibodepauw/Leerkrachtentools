import { z } from "zod";
import {
  normalizeAudioMediaType,
  REFLECTION_AUDIO_MEDIA_TYPES,
} from "@/lib/ai/audioMediaType";
import { WRITING_STYLES } from "@/lib/ai/writingStyle";

export const MAX_AI_TEXT_CHARS = 500_000;
export const MAX_BASE64_CHARS = 20_000_000;

export const aiProviderSchema = z.enum([
  "google",
  "groq",
  "cerebras",
  "sambanova",
  "cloudflare",
]);

const manualMediaTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
] as const;

const reflectionMediaTypes = REFLECTION_AUDIO_MEDIA_TYPES;

export const analysisRequestSchema = z
  .object({
    provider: aiProviderSchema.optional(),
    content: z.string().max(MAX_AI_TEXT_CHARS).optional(),
    goal: z.string().max(10_000).optional(),
    goals: z.array(z.string().max(10_000)).max(20).optional(),
    lessonGoal: z.string().max(10_000).optional(),
    totalMinutes: z.number().min(1).max(240).optional(),
    phase: z.string().max(500).optional(),
    materials: z.array(z.string().max(500)).max(100).optional(),
    targetGroup: z.string().max(500).optional(),
    learningArea: z.string().max(500).optional(),
    component: z.string().max(500).optional(),
    topic: z.string().max(500).optional(),
    educationNetwork: z.enum(["ZILL", "OVSG", "GO"]).optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    for (const [key, fieldValue] of Object.entries(value)) {
      if (typeof fieldValue !== "string") continue;
      const maxLength =
        key.toLowerCase().includes("data") || key.toLowerCase().includes("audio")
          ? MAX_BASE64_CHARS
          : MAX_AI_TEXT_CHARS;
      if (fieldValue.length > maxLength) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Veld ${key} overschrijdt de maximale lengte.`,
          path: [key],
        });
      }
    }
  });

export const manualExtractionRequestSchema = z
  .object({
    fileName: z.string().max(500).optional(),
    content: z.string().max(MAX_AI_TEXT_CHARS).optional(),
    fileData: z.string().max(MAX_BASE64_CHARS).optional(),
    mediaType: z.enum(manualMediaTypes).optional(),
  })
  .refine((value) => Boolean(value.fileData?.trim() || value.content?.trim()), {
    message: "Upload een handleiding of plak eerst tekst.",
  });

export const reflectionRequestSchema = z
  .object({
    goals: z.array(z.string().max(10_000)).max(20).optional(),
    content: z.string().max(MAX_AI_TEXT_CHARS).optional(),
    audioData: z.string().max(MAX_BASE64_CHARS).optional(),
    mediaType: z
      .string()
      .optional()
      .transform((value) => normalizeAudioMediaType(value))
      .pipe(z.enum(reflectionMediaTypes).optional()),
  })
  .transform((value) => ({
    ...value,
    mediaType:
      value.mediaType ??
      (value.audioData?.trim() ? ("audio/webm" as const) : undefined),
  }))
  .refine((value) => Boolean(value.content?.trim() || value.audioData?.trim()), {
    message: "Voeg tekst, antwoorden of een opname toe.",
  });

export type AnalysisRequestInput = z.infer<typeof analysisRequestSchema>;
export type ManualExtractionRequestInput = z.infer<
  typeof manualExtractionRequestSchema
>;
export type ReflectionRequestInput = z.infer<typeof reflectionRequestSchema>;

export const formatDialogueRequestSchema = z.object({
  content: z.string().min(1).max(MAX_AI_TEXT_CHARS),
  style: z.enum(WRITING_STYLES).default("thomas-more"),
});

export type FormatDialogueRequestInput = z.infer<
  typeof formatDialogueRequestSchema
>;
