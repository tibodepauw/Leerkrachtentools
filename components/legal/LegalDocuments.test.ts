import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const legal = readFileSync(new URL("./LegalDocuments.tsx", import.meta.url), "utf8");
const auth = readFileSync(new URL("../auth/AuthScreen.tsx", import.meta.url), "utf8");
const settings = readFileSync(
  new URL("../auth/AccountSettings.tsx", import.meta.url),
  "utf8",
);
const sidebar = readFileSync(
  new URL("../layout/Sidebar.tsx", import.meta.url),
  "utf8",
);
const nextConfig = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");
const privacyPage = readFileSync(
  new URL("../../app/privacy/page.tsx", import.meta.url),
  "utf8",
);
const termsPage = readFileSync(
  new URL("../../app/voorwaarden/page.tsx", import.meta.url),
  "utf8",
);
const imprintPage = readFileSync(
  new URL("../../app/juridisch/page.tsx", import.meta.url),
  "utf8",
);

describe("Legal document links", () => {
  it("opent externe documenten in een nieuw tabblad", () => {
    expect(legal).toContain('target="_blank"');
    expect(legal).toContain('rel="noopener noreferrer"');
    expect(legal).toContain(
      "Door in te loggen ga je akkoord met onze",
    );
    expect(legal).toContain("Algemene Voorwaarden");
    expect(legal).toContain("Privacybeleid");
  });

  it("toont voorwaarden, privacy en juridische informatie in settings en sidebar", () => {
    expect(settings).toContain("LegalDocumentNav");
    expect(sidebar).toContain("LegalDocumentNav");
    expect(auth).toContain("LegalDocumentNav");
    expect(auth).toContain("LegalConsentLine");
  });

  it("stuurt oude in-app paden door naar Generative Labs", () => {
    expect(nextConfig).toContain('source: "/privacy"');
    expect(nextConfig).toContain("GENERATIVE_LABS_LEGAL.privacy");
    expect(nextConfig).toContain('source: "/voorwaarden"');
    expect(nextConfig).toContain("GENERATIVE_LABS_LEGAL.terms");
    expect(nextConfig).toContain('source: "/juridisch"');
    expect(nextConfig).toContain("GENERATIVE_LABS_LEGAL.imprint");
    expect(proxy).toContain('pathname === "/voorwaarden"');
    expect(proxy).toContain('pathname === "/juridisch"');
    expect(privacyPage).toContain("redirect(GENERATIVE_LABS_LEGAL.privacy)");
    expect(termsPage).toContain("redirect(GENERATIVE_LABS_LEGAL.terms)");
    expect(imprintPage).toContain("redirect(GENERATIVE_LABS_LEGAL.imprint)");
    expect(privacyPage).not.toContain("Privacy- en Gegevensbeleid");
    expect(privacyPage).not.toContain("Verwerkingsverantwoordelijke");
  });
});
