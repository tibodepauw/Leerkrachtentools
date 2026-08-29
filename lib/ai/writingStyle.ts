import { baseSystemPrompt, prompts } from "@/lib/ai/prompts";

export const WRITING_STYLES = [
  "thomas-more",
  "normaal",
  "kort",
  "lang",
] as const;

export type WritingStyle = (typeof WRITING_STYLES)[number];

export const WRITING_STYLE_LABELS: Record<WritingStyle, string> = {
  "thomas-more": "Thomas More",
  normaal: "Normaal",
  kort: "Kort",
  lang: "Lang",
};

export function isWritingStyle(value: string): value is WritingStyle {
  return (WRITING_STYLES as readonly string[]).includes(value);
}

export function dialoguePromptForStyle(style: WritingStyle): string {
  switch (style) {
    case "thomas-more":
      return prompts.dialogue;
    case "normaal":
      return `${baseSystemPrompt}
Herschrijf lesnotities in heldere, professionele instructietaal voor leerkrachten
lager onderwijs. Behoud alle didactische stappen, vragen en organisatorische
aanwijzingen. Gebruik korte alinea's of opsommingen waar dat de leesbaarheid
verbetert. Verzin geen nieuwe inhoud.`;
    case "kort":
      return `${baseSystemPrompt}
Herschrijf lesnotities bondig zonder essentiele stappen, vragen of organisatie
te verliezen. Gebruik korte zinnen en compacte opsommingen. Verzin geen nieuwe
inhoud.`;
    case "lang":
      return `${baseSystemPrompt}
Werk lesnotities uit tot een volledige, didactisch duidelijke instructie voor
leerkrachten lager onderwijs. Voeg waar nodig korte overgangszinnen, voorbeelden
en organisatorische verduidelijking toe, maar verzin geen nieuwe lesinhoud of
doelen.`;
  }
}

export function formatDialogueInstruction(
  style: WritingStyle,
  content: string,
): string {
  const trimmed = content.trim();

  switch (style) {
    case "thomas-more":
      return `Zet onderstaande ruwe lesfase of instructie om naar strikt Thomas More
Lk:/Lln:-formaat met cursieve bord- en organisatieacties.

Tekst:
${trimmed}`;
    case "normaal":
      return `Herschrijf onderstaande lesnotities in een heldere, professionele
schrijfstijl voor leerkrachten.

Tekst:
${trimmed}`;
    case "kort":
      return `Maak onderstaande lesnotities zo kort mogelijk, maar behoud alle
essentiele stappen en aanwijzingen.

Tekst:
${trimmed}`;
    case "lang":
      return `Werk onderstaande lesnotities uit tot een volledige, goed leesbare
instructie met voldoende context en overgangen.

Tekst:
${trimmed}`;
  }
}
