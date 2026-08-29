import { describe, expect, it } from "vitest";
import {
  normalizeAudioMediaType,
  resolveReflectionMediaType,
} from "@/lib/ai/audioMediaType";

describe("audioMediaType", () => {
  it("normaliseert codec-suffixen naar basistype", () => {
    expect(normalizeAudioMediaType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeAudioMediaType("audio/ogg;codecs=opus")).toBe("audio/ogg");
  });

  it("valt terug op webm wanneer audio aanwezig is zonder geldig type", () => {
    expect(
      resolveReflectionMediaType({
        mediaType: "audio/webm;codecs=opus",
        hasAudio: true,
      }),
    ).toBe("audio/webm");
    expect(
      resolveReflectionMediaType({
        mediaType: "",
        hasAudio: true,
      }),
    ).toBe("audio/webm");
  });

  it("laat mediaType leeg zonder audio", () => {
    expect(
      resolveReflectionMediaType({
        mediaType: undefined,
        hasAudio: false,
      }),
    ).toBeUndefined();
  });
});
