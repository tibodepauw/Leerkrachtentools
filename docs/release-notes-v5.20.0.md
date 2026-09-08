# Leerkrachtentools v5.20.0

Quota-ledger, ZIP-grenzen, PostHog-privacy, en een correcte B2B Pro-identiteit.

---

## B2B-quota

- Organisatiebudget wordt in één SQLite-transactie gereserveerd vóór de zware handler
- Burst, concurrency en een globaal in-flight-plafond zitten op datzelfde ledger
- Validatiefouten tellen niet; gestart werk blijft geteld als het loggen faalt
- `Idempotency-Key` telt niet dubbel
- Twee sleutels van dezelfde organisatie delen het maandbudget
- Een vloed van 429's schrijft niet langer één usage-logrij per request

## Documenten en preview

- ZIP-import en -export tellen echte inflated bytes en stoppen vóór de entry-limiet
- Eerlijke én vervalste oversized metadata worden allebei geweigerd
- Word-preview zet `renderAltChunks: false`

## Privacy en login

- PostHog session replay staat uit; les- en feedback-UI gebruiken `ph-no-capture`
- PostHog-identiteit reset bij logout en accountwissel
- Accountverwijdering wist pending logincodes; het dagelijkse AI-budget blijft via e-mail-HMAC gebonden tot het einde van het venster
- Onbetrouwbare IP-headers delen geen login-emmer meer voor elke bezoeker

## RAG en Pro

- Query rewriting volgt dezelfde BYOK-provider als andere AI-calls
- Een rewrite die start en daarna faalt houdt de gereserveerde eenheid
- B2B Pro gebruikt een organisatiebudgetpad en geeft `requestedMode`, `executedMode` en `proFallback` terug

## Operatie

- Standalone build kopieert `public` en `.next/static`
- Dev-logincodes worden in productie genegeerd
- Externe Groq-, Cerebras-, Discovery Engine- en fetch-calls stoppen na 12 seconden
- Juridisch colofon voor AHOVOKS, koepelrechten en EU AI Act art. 50
- README documenteert het organisatie-quota-ledger, match-citatievelden, PostHog-privacy, standalone asset-copy en het huidige testaantal

---

**Volledige changelog:** [CHANGELOG.md](https://github.com/tibodepauw/Leerkrachtentools/blob/main/CHANGELOG.md)
