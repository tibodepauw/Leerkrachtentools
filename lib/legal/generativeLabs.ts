export const GENERATIVE_LABS_LEGAL = {
  terms: "https://www.generativelabs.be/voorwaarden.html",
  privacy: "https://www.generativelabs.be/privacy.html",
  imprint: "https://www.generativelabs.be/juridisch.html",
} as const;

export const LEGAL_NAV_ITEMS = [
  { href: GENERATIVE_LABS_LEGAL.terms, label: "Voorwaarden" },
  { href: GENERATIVE_LABS_LEGAL.privacy, label: "Privacy" },
  { href: GENERATIVE_LABS_LEGAL.imprint, label: "Juridische informatie" },
] as const;
