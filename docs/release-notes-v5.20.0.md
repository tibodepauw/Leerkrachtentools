# Leerkrachtentools v5.20.0

Quota ledger, ZIP bounds, PostHog privacy, and a correct B2B Pro identity.

---

## B2B quota

- Organization budget is reserved in one SQLite transaction before the heavy handler
- Burst, concurrency and a global in-flight cap sit on that same ledger
- Validation errors do not consume; started work stays consumed if logging fails
- `Idempotency-Key` does not double-spend
- Two keys of the same organization share the monthly budget
- A flood of 429s no longer writes one usage-log row per request

## Documents and preview

- ZIP import and export count actual inflated bytes and stop before the entry limit
- Honest and forged oversized metadata are both rejected
- Word preview sets `renderAltChunks: false`

## Privacy and login

- PostHog session replay is off; lesson and feedback UI use `ph-no-capture`
- PostHog identity resets on logout and account switch
- Account deletion wipes pending login codes; the daily AI budget stays bound to the e-mail HMAC for the rest of the window
- Untrusted IP headers no longer share one login bucket for every visitor

## RAG and Pro

- Query rewriting follows the same BYOK provider as other AI calls
- A rewrite that starts and then fails keeps the reserved unit
- B2B Pro uses an organization budget path and returns `requestedMode`, `executedMode` and `proFallback`

## Operations

- Standalone build copies `public` and `.next/static`
- Dev login codes are ignored in production
- External Groq, Cerebras, Discovery Engine and fetch calls abort after 12 seconds
- Legal colophon for AHOVOKS, koepelrechten and EU AI Act art. 50

---

**Volledige changelog:** [CHANGELOG.md](https://github.com/tibodepauw/Leerkrachtentools/blob/main/CHANGELOG.md)
