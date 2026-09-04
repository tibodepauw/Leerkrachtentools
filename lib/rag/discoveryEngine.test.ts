import { describe, expect, it } from "vitest";
import {
  DiscoveryEngineTimeoutError,
  extractRelevanceScore,
  isDiscoveryTransportError,
  networkFromUri,
  raceWithTimeout,
  swallowBackgroundRejection,
  titleFromLink,
} from "@/lib/rag/discoveryEngine";

describe("discoveryEngine helpers", () => {
  it("haalt titels uit GCS-paden", () => {
    expect(
      titleFromLink("gs://leerkrachtentools-curriculum/opstap/wiskunde_leerplan.pdf"),
    ).toBe("wiskunde leerplan");
  });

  it("onderscheidt oude GO!-basisplannen van GO! secundair", () => {
    expect(
      networkFromUri(
        "gs://leerkrachtentools-curriculum/go/leerplan_nederlands.pdf",
      ),
    ).toBe("GO_OUD");
    expect(
      networkFromUri(
        "gs://leerkrachtentools-curriculum/secundair/leerplannen_secundair_go.txt",
      ),
    ).toBe("GO");
  });

  it("gebruikt rankSignals voor relevantiescore", () => {
    expect(
      extractRelevanceScore(
        { rankSignals: { relevanceScore: 0.83 } },
        0,
      ),
    ).toBe(0.83);
  });

  it("breekt een hangende Discovery-aanroep af", async () => {
    await expect(
      raceWithTimeout(new Promise(() => undefined), 25),
    ).rejects.toBeInstanceOf(DiscoveryEngineTimeoutError);
  });

  it("slikt late rejects na time-out zodat de HTTP-request niet crasht", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    let rejectLater: ((error: Error) => void) | undefined;
    const hanging = new Promise<never>((_, reject) => {
      rejectLater = reject;
    });

    await expect(raceWithTimeout(hanging, 20)).rejects.toBeInstanceOf(
      DiscoveryEngineTimeoutError,
    );
    rejectLater?.(new Error("late gRPC-fout"));
    await new Promise((resolve) => setTimeout(resolve, 30));
    process.off("unhandledRejection", onUnhandled);
    expect(unhandled).toEqual([]);
  });

  it("annuleert de achtergrondpromise via AbortController bij time-out", async () => {
    const abort = new AbortController();
    await expect(
      raceWithTimeout(new Promise(() => undefined), 20, { abort }),
    ).rejects.toBeInstanceOf(DiscoveryEngineTimeoutError);
    expect(abort.signal.aborted).toBe(true);
  });

  it("vangt de ruwe Google-promise af zodat een late gRPC-fout het proces niet laat crashen", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    let rejectGoogle: ((error: Error) => void) | undefined;
    const googlePromise = new Promise<string>((_, reject) => {
      rejectGoogle = reject;
    });
    swallowBackgroundRejection(googlePromise);

    await expect(raceWithTimeout(googlePromise, 15)).rejects.toBeInstanceOf(
      DiscoveryEngineTimeoutError,
    );
    rejectGoogle?.(new Error("late gRPC-fout"));
    await new Promise((resolve) => setTimeout(resolve, 30));
    process.off("unhandledRejection", onUnhandled);
    expect(unhandled).toEqual([]);
  });

  it("herkent Discovery-transportfouten", () => {
    expect(isDiscoveryTransportError(new DiscoveryEngineTimeoutError())).toBe(
      true,
    );
    expect(isDiscoveryTransportError(new Error("Failed to fetch"))).toBe(true);
    expect(isDiscoveryTransportError(new Error("ongeldige query"))).toBe(false);
  });
});
