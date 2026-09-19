// Versioned query URLs avoid previously cached permanent redirects to the old company pages.
export const GENERATIVE_LABS_LEGAL = {
  terms: "/voorwaarden?versie=2026-09-13",
  privacy: "/privacy?versie=2026-09-19",
  imprint: "https://www.generativelabs.be/juridisch.html",
} as const;

export const LEGAL_NAV_ITEMS = [
  { href: GENERATIVE_LABS_LEGAL.terms, label: "Voorwaarden" },
  { href: GENERATIVE_LABS_LEGAL.privacy, label: "Privacy" },
  { href: GENERATIVE_LABS_LEGAL.imprint, label: "Juridische informatie" },
] as const;
