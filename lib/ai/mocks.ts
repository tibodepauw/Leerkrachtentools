import type { ReflectionDraft } from "@/types";

export const mockManualExtraction = {
  learningArea: "Mens en maatschappij",
  component: "Historische tijd",
  topic: "De Romeinen",
  targetGroup: "Vierde leerjaar",
  materials: ["tijdlijn", "bronnenkaarten", "werkblad"],
  rawPublisherGoals: [
    "De leerlingen situeren de Romeinse tijd op een tijdlijn.",
    "De leerlingen benoemen kenmerken van een Romeinse stad.",
    "De leerlingen vergelijken wonen toen en nu.",
  ],
};

export function mockGoalAnalysis(original: string) {
  return {
    original,
    improved:
      "De leerlingen kunnen minstens drie kenmerken van een Romeinse stad correct benoemen aan de hand van een bronnenkaart.",
    taxonomy: "MC" as const,
    rationale:
      "Dit is een mentaal-cognitief doel omdat leerlingen kennis waarneembaar oproepen en benoemen.",
    removedTerms: ["kennen", "begrijpen"],
    addedTerms: ["benoemen", "minstens drie", "aan de hand van een bronnenkaart"],
    criteria: ["minstens drie kenmerken", "correct", "met bronnenkaart"],
  };
}

export const mockDialogue = {
  formatted: `*[Bordschema: titel “De Romeinen” bovenaan]*\n\nLk: “Bekijk de tijdlijn. In welke periode plaatsen we de Romeinen?”\n\nLln: “In de oudheid.”\n\n*[Organisatie: leerlingen werken per twee met een bronnenkaart]*`,
  interventions: 2,
};

export function mockSpellcheck(text: string) {
  const improved =
    text.trim() ||
    "De leerlingen vergelijken hun antwoord met de correctiesleutel.";
  return {
    improved,
    issues: [
      {
        original: "wordt verbeterd",
        replacement: "verbeter",
        reason: "Gebruik een directe, formele instructie.",
      },
    ],
  };
}

export const mockTimingAdvice = {
  suggestions: [
    "Beperk de instructie tot 15 minuten en reserveer minstens 20 minuten voor zelfstandige verwerking.",
    "Voorzie 5 minuten afronding om D1–D3 zichtbaar te evalueren.",
  ],
  rationale:
    "Een korte expliciete instructie en ruime oefentijd ondersteunen actieve verwerking.",
};

export function mockAlignment(goals: string[]) {
  return {
    rows: goals.filter(Boolean).map((goal, index) => ({
      goal: goal || `D${index + 1}`,
      instruction: "gedekt" as const,
      practice: index === 1 ? ("gedeeltelijk" as const) : ("gedekt" as const),
      evaluation:
        index === 2 ? ("ontbreekt" as const) : ("gedeeltelijk" as const),
      advice:
        index === 2
          ? "Voeg in de afronding één observeerbare controle voor dit doel toe."
          : "Maak het succescriterium expliciet zichtbaar.",
    })),
  };
}

const engagementNames = [
  "Leeractiviteit",
  "Werkelijkheidsnabijheid",
  "Leerlingeninitiatief",
  "Positief klasklimaat",
  "Expressie",
  "Samen leren",
];

export const mockEngagement = {
  factors: engagementNames.map((name, index) => ({
    name,
    status:
      index < 2
        ? ("aanwezig" as const)
        : index < 4
          ? ("gedeeltelijk" as const)
          : ("ontbreekt" as const),
    evidence:
      index < 2
        ? "De les bevat een concrete, actieve opdracht."
        : "Er is onvoldoende expliciet bewijs in de lesvoorbereiding.",
    suggestion:
      "Voeg een korte keuze-, duo- of expressieopdracht toe die bij de lesinhoud past.",
  })),
};

export const mockFullAudit = {
  score: 72,
  criteria: [
    {
      label: "Lesdoelen",
      status: "groen" as const,
      finding: "De doelen zijn grotendeels observeerbaar.",
      improvement: "Voeg per doel één concreet succescriterium toe.",
    },
    {
      label: "Constructive alignment",
      status: "oranje" as const,
      finding: "Niet elk doel wordt in de afronding gecontroleerd.",
      improvement: "Sluit af met drie korte controles, één per D-doel.",
    },
    {
      label: "Timing",
      status: "oranje" as const,
      finding: "De instructiefase is relatief lang.",
      improvement: "Verschuif vijf minuten naar zelfstandige verwerking.",
    },
  ],
};

export function mockReflection(goals: string[]): ReflectionDraft {
  const goalRows = goals.filter(Boolean).map((_, index) => ({
    id: `D${index + 1}`,
    reach: index === 0 ? ("meerderheid" as const) : ("onbekend" as const),
    evidence:
      index === 0
        ? "De meeste leerlingen voerden de afsluitende opdracht correct uit."
        : "",
  }));
  const questions: string[] = [];
  if (goalRows.some((goal) => goal.reach === "onbekend")) {
    questions.push("Bereikte bij D2 en D3 een meerderheid of minderheid het doel?");
  }
  if (goalRows.some((goal) => !goal.evidence)) {
    questions.push("Welk concreet leerlinggedrag toont dat de doelen bereikt zijn?");
  }
  return {
    goals: goalRows,
    engagement: [],
    teacherIdentity: "",
    followUpQuestions: questions.slice(0, 2),
  };
}
