import { describe, expect, it } from "vitest";
import type { CurriculumSearchResult } from "@/types";
import {
  buildProCurriculumPrompt,
  groundProPicks,
  normalizeCurriculumCode,
  parseCurriculumSearchMode,
  parseProLessonContext,
  PRO_FALLBACK_NOTICES,
  withProFallbackSentence,
} from "@/lib/rag/selectProCurriculumGoals";

function goal(
  overrides: Partial<CurriculumSearchResult> & { code: string; titel: string },
): CurriculumSearchResult {
  return {
    discipline: "Muzische vorming",
    subdomein: "Drama",
    toelichting: "Officiële toelichting",
    leerjaarRoute: "L3",
    gelinktMinimumdoel: null,
    netwerk: "ZILL",
    bronUrl: "https://example.test",
    ...overrides,
  };
}

describe("selectProCurriculumGoals", () => {
  it("leest alleen de Pro-modus uit een expliciete waarde", () => {
    expect(parseCurriculumSearchMode("pro")).toBe("pro");
    expect(parseCurriculumSearchMode("snel")).toBe("snel");
    expect(parseCurriculumSearchMode("PRO")).toBe("snel");
    expect(parseCurriculumSearchMode(undefined)).toBe("snel");
  });

  it("normaliseert codes zonder extra spaties", () => {
    expect(normalizeCurriculumCode(" wd 4.1 ")).toBe("WD4.1");
  });

  it("koppelt AI-picks uitsluitend aan opgehaalde officiële doelen", () => {
    const retrieved = [
      goal({ code: "MUZ.D.3", titel: "Emoties uitbeelden met mimiek" }),
      goal({ code: "MUZ.D.4", titel: "Een rol spelen in een korte scène" }),
      goal({ code: "MUZ.M.1", titel: "Een ritme nazingen" }),
    ];

    const grounded = groundProPicks(retrieved, [
      {
        code: "MUZ.D.3",
        why: "De activiteit vraagt om emoties zichtbaar maken.",
        lessonPhase: "Verwerking",
      },
      {
        code: "VERZONNEN.99",
        why: "Dit doel bestaat niet.",
        lessonPhase: "Instap",
      },
      {
        code: "muz.d.4",
        why: "Spel en rol passen bij de les.",
        lessonPhase: "Instructie",
      },
      {
        code: "MUZ.M.1",
        why: "Een derde geldige keuze.",
        lessonPhase: "Afronding",
      },
      {
        code: "MUZ.D.3",
        why: "Duplicaat mag niet opnieuw binnenkomen.",
        lessonPhase: "Instap",
      },
    ]);

    expect(grounded.map((item) => item.code)).toEqual([
      "MUZ.D.3",
      "MUZ.D.4",
      "MUZ.M.1",
    ]);
    expect(grounded[0]?.titel).toBe("Emoties uitbeelden met mimiek");
    expect(grounded[0]?.proWhy).toBe(
      "De activiteit vraagt om emoties zichtbaar maken.",
    );
    expect(grounded[0]?.proLessonPhase).toBe("Verwerking");
    expect(grounded.some((item) => item.code === "VERZONNEN.99")).toBe(false);
  });

  it("neemt nooit verzonnen doeltekst van het model over", () => {
    const retrieved = [
      goal({ code: "WD4.1", titel: "Officiële maaltafeldoelzin" }),
    ];
    const grounded = groundProPicks(retrieved, [
      {
        code: "WD4.1",
        why: "Past bij vlot opzeggen.",
        lessonPhase: "Instructie",
      },
    ]);

    expect(grounded).toHaveLength(1);
    expect(grounded[0]?.titel).toBe("Officiële maaltafeldoelzin");
    expect(grounded[0]?.titel).not.toContain("verzinnen");
  });

  it("geeft een lege selectie terug als geen code grounded is", () => {
    const retrieved = [goal({ code: "WD4.1", titel: "Maaltafels" })];
    expect(
      groundProPicks(retrieved, [
        { code: "FAKE.1", why: "Nee", lessonPhase: "Instap" },
      ]),
    ).toEqual([]);
  });

  it("bouwt een prompt met lesfasen en kandidaatcodes", () => {
    const prompt = buildProCurriculumPrompt({
      query: "emoties uitbeelden met mimiek",
      retrieved: [goal({ code: "MUZ.D.3", titel: "Emoties uitbeelden" })],
      lesson: parseProLessonContext({
        topic: "Emoties",
        learningArea: "Muzische vorming",
        grade: "l3",
        ageRange: "8-9 jaar",
        phases: [
          { name: "Instap", text: "Korte kring" },
          { name: "Verwerking", text: "Mimiekspel" },
        ],
      }),
    });

    expect(prompt).toContain("MUZ.D.3");
    expect(prompt).toContain("emoties uitbeelden met mimiek");
    expect(prompt).toContain("Mimiekspel");
    expect(prompt).toContain("kies ALLEEN hieruit");
  });

  it("voegt een vriendelijke fallbackzin toe", () => {
    expect(withProFallbackSentence("Geen toegang")).toBe(
      "Geen toegang. Dit zijn de snelle zoekkaarten.",
    );
    expect(PRO_FALLBACK_NOTICES.noProvider).toMatch(/snelle zoekkaarten/);
  });
});
