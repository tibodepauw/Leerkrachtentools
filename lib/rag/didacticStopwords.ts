/** Pedagogical filler that should not drive curriculum matching. */
export const DIDACTIC_STOPWORDS = new Set([
  "de",
  "het",
  "een",
  "leerling",
  "leerlingen",
  "kinderen",
  "kind",
  "kindjes",
  "kleuters",
  "kunnen",
  "toepassen",
  "toepas",
  "toepassing",
  "eenvoudige",
  "eenvoudig",
  "vlot",
  "vlotte",
  "ontwikkelen",
  "ontwikkeling",
  "inzicht",
  "inzichten",
  "kennen",
  "weten",
  "gebruiken",
  "ervaren",
  "ervaring",
  "stevige",
  "stevig",
  "groepjes",
  "groepje",
  "groepen",
  "opzeggen",
  "opzeg",
  "nastreven",
  "zijn",
  "wat",
  "hoe",
  "in",
  "op",
  "van",
  "met",
  "kan",
  "deze",
  "dat",
  "voor",
  "bij",
  "worden",
  "door",
  "naar",
  "ook",
  "nog",
  "als",
  "dan",
  "tot",
  "uit",
  "er",
  "om",
  "der",
  "des",
  "maken",
  "doen",
]);

const DIDACTIC_STOP_PHRASES = [
  "de leerlingen kunnen",
  "de kinderen kunnen",
  "de kleuters kunnen",
  "de leerlingen",
  "de leerling",
  "de kinderen",
  "de kleuters",
  "in groepjes",
  "in groepje",
  "in groepen",
];

export function stripDidacticPhrases(text: string): string {
  let result = text;
  for (const phrase of DIDACTIC_STOP_PHRASES) {
    result = result.replaceAll(phrase, " ");
  }
  return result.replace(/\s+/g, " ").trim();
}

export function isDidacticStopword(token: string): boolean {
  return DIDACTIC_STOPWORDS.has(token);
}
