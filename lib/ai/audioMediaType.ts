export const REFLECTION_AUDIO_MEDIA_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
] as const;

export type ReflectionAudioMediaType =
  (typeof REFLECTION_AUDIO_MEDIA_TYPES)[number];

export function normalizeAudioMediaType(
  value?: string | null,
): ReflectionAudioMediaType | undefined {
  if (!value?.trim()) return undefined;

  const base = value.split(";")[0]?.trim().toLowerCase();
  if (
    base &&
    (REFLECTION_AUDIO_MEDIA_TYPES as readonly string[]).includes(base)
  ) {
    return base as ReflectionAudioMediaType;
  }

  return undefined;
}

export function resolveReflectionMediaType({
  mediaType,
  hasAudio,
}: {
  mediaType?: string | null;
  hasAudio: boolean;
}) {
  return normalizeAudioMediaType(mediaType) ?? (hasAudio ? "audio/webm" : undefined);
}

export function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return undefined;

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
    "audio/wav",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}
