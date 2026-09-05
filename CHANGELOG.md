# Changelog

All notable changes to **Leerkrachtentools** are documented here.  
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Releases: [GitHub Releases](https://github.com/tibodepauw/Leerkrachtentools/releases)

## [Unreleased]

### Added
- Installable PWA with standalone display, app icons, an offline page, and an install card in Settings

---

## [5.16.0] - 2026-09-05

Pinned sidebar tools, a separate GO! / Oud leerplan option, and curriculum
search that stays available when Discovery Engine times out.

### Added
- Sidebar pins persist in the browser and on the user account after login
- GO! / Oud leerplan as a separate basisonderwijs option next to GO! / Nieuw leerplan
- Didactic stopword filtering, math and technology domain boosting, and typo-tolerant matching in curriculum search
- Multi-intent ranking so mixed queries keep both domains in the top results

### Changed
- Login verification email uses the black, zinc and Rubik brand and stays readable in Outlook, Gmail and dark mode
- Invalid production configuration fails closed at Node startup

### Fixed
- Curriculum search no longer drops the browser connection after a Discovery Engine timeout
- Timed-out Google searches are aborted so late gRPC errors cannot crash the Node process
- SearchServiceClient is reused across Fast Refresh instead of leaking gRPC sockets
- Unexpected RAG route errors always return HTTP 200 JSON with empty results

### Security
- Production authentication boundaries, cookie options, avatar path containment, and request body limits hardened
- Node startup terminates when required production secrets are missing

---

## [5.15.1] - 2026-09-04

### Fixed
- Zaklampeffect op de login-wordmark vervaagt naadloos aan de bovenrand zonder zichtbare horizontale scheidingslijn

---

## [5.15.0] - 2026-09-04

Production security hardening, corrected curriculum retrieval, and a cleaner
settings and module experience.

### Added
- Server-side request budgets for API, AI, RAG, and document routes
- Per-user concurrency limits for AI-provider calls and heavy document/RAG work
- Five-minute Discovery Engine cache with coalescing for identical searches
- Per-request nonce CSP, same-origin mutation checks, HSTS, and hidden framework fingerprint
- Versioned API-key encryption envelopes with provider/user binding and previous-key rotation support
- OSV production dependency audit in local scripts and GitHub CI
- Security regression tests for CSRF, request bodies, rate limits, storage isolation, archive validation, and credential failures

### Changed
- Session lifetime reduced to seven days with a 24-hour idle limit; a new login invalidates older sessions
- Development login codes require an explicit localhost-only opt-in
- Tester access is configured through production environment allowlists only
- AI fallback is bounded to two provider attempts under one 45-second deadline
- AI and RAG payloads use strict schemas and bounded streaming JSON readers
- Document upload limit reduced to 8 MB and scanner extraction requires review before copying into Actieve les
- Settings keeps account-scoped browser storage mounted between app routes
- Sidebar pins appear only while hovering; hover labels use Dutch copy
- Settings copy, muted helper text, duplicate notices, and decorative hairlines simplified
- Curriculum search button shows a delayed loading state without flicker

### Fixed
- Saved API-keys can no longer be reused or sent to a different provider
- Broken or rotated user credentials fail closed instead of falling back to serverkeys
- Account deletion removes server metadata, localStorage, and IndexedDB data
- Legacy IndexedDB migration can no longer copy documents to multiple browser users
- IP rate limiting only trusts explicitly configured reverse proxies
- Failed paid provider attempts remain counted against quota
- Google model discovery sends API-keys in a header instead of the URL
- Raw provider and document parser errors are no longer exposed to clients
- DOCX/ODT archive bombs, mismatched file signatures, invalid Cloudflare paths, and oversized request bodies are rejected
- ALL-level curriculum search, GO/GO Nieuw mapping, secondary minimum-goal filtering, and corpus cache scoping corrected
- Goal identifiers, add-to-lesson replacement, voice answers, and active-goal synchronization corrected
- Settings navigation no longer remounts and reruns account storage migration

### Security
- No known vulnerabilities were found across 278 production packages in the release audit
- Next.js 16.3.3 and React 19.2.8 include the August 2026 security fixes
- Server API authorization remains enforced independently of UI visibility and Proxy
- Uploaded manual content is treated as untrusted input and is never auto-applied

---

## [5.14.0] - 2026-09-03

### Added
- Invite-only login met eenmalige e-mailcode in zes aparte vakken
- Glow-outline wordmark op het inlogscherm
- Pin-animatie: tools schuiven vanuit hun sectie omhoog naar Gepind

### Changed
- Generative Labs huisstijl is het vaste ontwerp van de app (geen Testversie-schakelaar meer)
- GitHub README-banner: Gather-animatie op het huisstijl-raster, met gradient op de letters
- Sidebar-sectielabels iets groter
- Kaartradius 20px overal, ook op geneste kaarten

### Fixed
- Actieve lescontext en feedbackkaders openden als een strook onderaan in plaats van een gecentreerd dialoogvenster
- Stippenraster verdween achter ondoorzichtige zwarte pagina-achtergronden

---

## [5.13.1] - 2026-08-31

### Changed
- Doelverbeteraar en MC-DAS-SPM herkenner: neutrale copy in prompts, UI en validatie
- Regelbestand hernoemd: `lib/goals/ko1Rules.ts` → `lib/goals/lessonGoalRules.ts`

### Fixed
- Domeinlabel verwijderd uit Doelverbeteraar-output; domeinclassificatie hoort bij de taxonomie-module

---

## [5.13.0] - 2026-08-31

### Added
- **Regels voor een goed lesdoel** voor Doelverbeteraar en MC-DAS-SPM herkenner (`lib/goals/lessonGoalRules.ts`, `lib/goals/goalSchemas.ts`)
- Zod-validatie: verboden werkwoorden, MC/DAS-aanhef, `subcategory` + `behaviorLevel` in taxonomie
- `AGENTS.md` met stijlregels (geen em dash, sentence case, release-titels met ▬)

### Changed
- System prompts voor `/api/analyze-goals` en `/api/classify-goal-taxonomy` uitgebreid met didactische lesdoelregels
- README banner: afgeronde hoeken vergroot naar 24px (GIF/PNG opnieuw geëxporteerd)
- Testcount: 207 tests

---

## [5.12.0] - 2026-08-31

### Added
- **Wordmark laadscherm** met Gather als standaard; varianten kiesbaar in Instellingen → Laadscherm (inclusief **Willekeurig**)
- **Smart loading gate**: volledige wordmark-splash bij site load/reload; geen splash bij snelle navigatie (warme cache)
- **Sidebar wordmark logo** (Rubik Black) met compacte Gather-animatie als easter egg bij klik
- **README banner**: geanimeerde Gather-GIF + PNG, afgeronde hoeken ingebakken in assets
- **Server-side module visibility** via env (`MODULES_ENABLED`, `USER_MODULE_GRANTS`, `USER_MODULE_DENIALS`)
- Banner export scripts (`npm run export:banner`) vanuit production build

### Changed
- Handleiding Scanner ondersteunt dezelfde documenttypes als lesimport, plus afbeeldingen
- Settings- en lesson-store gebruiken gescheiden localStorage-sleutels (loader-keuze blijft bewaard)
- README badges en testcount bijgewerkt (200 tests)

### Fixed
- Custom loader-variant zichtbaar na page reload (splash hold + sync storage read)
- LoadingGate hydration mismatch op `/settings`
- Loader preview in instellingen: static preview, play-knop, geen overflow
- Sidebar wordmark gather-animatie: geen clipping door onzichtbaar overflow-kader
- README GIF zonder Next.js dev overlay (export vanuit production)

### Security
- Hardcoded API keys en admin-e-mails verwijderd uit publieke repo
- `AGENTS.md` met stijlregels; optionele agent-bestanden (`CLAUDE.md`, `GEMINI.md`) blijven gitignored

---

## [5.11.0] - 2026-08-30

### Added
- **Client-side exact query cache** (`lib/rag/clientQueryCache.ts`): `sessionStorage`-cache voor RAG-zoekresultaten met sleutel `${educationLevel}:${network}:${normalizedQuery}`; hook `useRagQueryAnalysis`
- SQLite index-optimalisatie via `lib/db/ensureIndexes.ts` (sessies + AI-gebruik op `user_id` / `created_at`)

### Changed
- Production security headers in `next.config.ts`: `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy: origin-when-cross-origin`, `Permissions-Policy`
- RAG-zoekopdrachten in Leerplandoelen/Minimumdoelen gebruiken sessie-cache vóór API-call

### Fixed
- RAG-querycache wordt gewist bij logout, accountwissel en automatisch bij tab-herladen (`sessionStorage`)

---

## [5.10.4] - 2026-08-30

### Added
- **Lazy loading RAG-corpora per onderwijsniveau** (`lib/rag/corpusLevelCache.ts`): on-demand laden i.p.v. volledige corpus bij server-start
- Max. 2 actieve niveau-caches in RAM, automatische unload na 5 min inactiviteit
- Tests voor corpus-level cache-evictie (`lib/rag/corpusLevelCache.test.ts`)

### Changed
- RAG-benchmark latency-drempel: 800 ms → **350 ms** (warme corpus-zoekopdrachten ~250-300 ms)
- Token-indexen gescopeerd per onderwijsniveau + netwerk; gecachte record-normalisatie voor snellere scans
- Minimumdoelen-zoekopdracht: gerichte retrieval voor korte reken-queries (`1 + 1`) en candidate-capping

### Fixed
- **Secundaire minimumdoelen** (klimaat/broeikaseffect): indexeer `gelinkt_minimumdoel`-tekst; OR-candidate retrieval voor multi-keyword queries
- **Onderwijsniveau-sync** tussen Minimumdoelen en Leerplandoelen (persistente filters, geen reset bij module-wissel)
- **Sidebar**: uitvouwen/invouwen-iconen (`PanelLeftOpen` / `PanelLeftClose`); gecentreerde iconen in ingeklapte modus
- Netwerkfoutmelding: stageschool-wifi-zinnetje verwijderd
- UI: model-detect-knop layout bij smalle sidebar-inhoud

---

## [5.10.0] - 2026-08-30

### Added
- **LLM Query Rewriting** (opt-in): instelling in Settings → herschrijft vage zoekopdrachten via Gemini 3.5 Flash Lite vóór RAG-retrieval
- `stores/useSettingsStore.ts`, `components/settings/SettingsView.tsx`, `lib/rag/queryRewriter.ts`
- Centrale Google-modelconfiguratie in `lib/ai/googleModel.ts`

### Changed
- Standaard Google AI-model: **`gemini-3.5-flash-lite`** (via `GOOGLE_MODEL` env override)
- Alle AI-endpoints gebruiken consequent `getGoogleModelId()` i.p.v. verouderde `gemini-2.5-flash-lite`-fallbacks

---

## [5.9.4] - 2026-08-30

### Fixed
- RAG: GO! PDF legende-/meta-pagina's uit corpus-index gefilterd
- RAG: Engels (+0.35), schrijfopstel-stemming, wiskunde/grammatica-disambiguatie bij `functie`
- RAG: typo-mapping `prorgammeren` → programmeren met ICT/STEM-bonus

---

## [5.9.3] - 2026-08-30

### Added
- RAG inverted token-index voor snellere corpus-scan (< 250 ms)
- Harde ruis-drempel `ABSOLUTE_MIN_SCORE = 0.18` tegen zwakke/toevallige matches
- Nederlandse getallen-normalizer en fonetische typos (`opptellingen tot twintich`)

### Changed
- RAG-benchmark: **10/10** (100% kwaliteitsscore)

---

## [5.9.2] - 2026-08-30

### Added
- RAG-benchmark testsuite (`test/rag-benchmark.test.ts`): 10 randgevallen, faithfulness/relevancy/latency checks, kwaliteitsscore-rapport
- `lib/rag/ragBenchmark.ts` met corpus-index, evaluatie-helpers en benchmark-case definities
- `npm run test:rag-benchmark` voor gerichte benchmark-run

---

## [5.9.1] - 2026-08-30

### Changed
- Leerplandoelen: enkel koepels (Op.stap, ZILL, KOV, GO!, OVSG, POV); AHOVOKS-domeinen uitsluitend in Minimumdoelen
- Doelkaarten: generieke toelichtingslabels (Ontwikkelingsdoelen, OV1, Type 2, …) worden niet meer getoond

---

## [5.9.0] - 2026-08-30

Feature release: volledige Vlaamse onderwijsdomeinen via onderwijsdoelen.be (AHOVOKS), gestroomlijnde secundaire pipeline en UX voor OKAN/BuBaO/BuSO/DKO.

### Added
- **Onderwijsniveaus** in Leerplandoelen en Minimumdoelen: OKAN, BuBaO, BuSO, DKO, volwassenenonderwijs, hoger onderwijs
- Dynamische domeinfilters per niveau (NT2/integratie, BuBaO-types, BuSO OV1-3, DKO-graad, …)
- Python-fetch via onderwijsdoelen.be API (~24.571 doelen): `npm run fetch:all`, `npm run fetch:domains`
- Uniform JSONL-schema + GCS `.txt`-export voor alle AHOVOKS-domeinen
- Gestroomlijnde secundaire scrape-pipeline: flat JSONL-schema, `secondary_record_schema.py`, auto GCS-export in `fetch_secundair_full.py`
- OKAN testfixture voor CI; domain-corpus laadt prod-data met fixture-fallback
- Documentatie: `docs/onderwijsdoelen-volledig-overzicht.md`

### Changed
- Leerplan-selectie schakelt automatisch naar AHOVOKS/ALL voor OKAN, BuBaO, BuSO, DKO, volwassenen en hoger onderwijs (geen ZILL-fallback meer)
- AHOVOKS-doelen: lange titel gesplitst op Verwerkingsniveau; details in Toelichting-accordion
- Leerplan-dropdown: statisch label bij enkel AHOVOKS-optie; netwerk sync bij niveauwissel
- README: fetch-scripts, AHOVOKS-domeinen, gitignore voor lokale domain-data

### Fixed
- Lege Leerplan-select (42px) wanneer netwerk niet matcht met gekozen onderwijsniveau

---

## [5.8.17] - 2026-08-30

### Added
- Secundair: graad- en finaliteitsfilters in Leerplandoelen en Minimumdoelen
- Secundair: leerjaren s1-s7 in Actieve les (doelgroep) met auto-sync naar filters
- Rankingbonus op graad/finaliteit in curriculum- en minimumdoelen-API

### Changed
- GO!-label bij secundair: "GO! · Secundair onderwijs" i.p.v. "Legacy leerplan"

---

## [5.8.16] - 2026-08-30

### Changed
- Label "Onderwijsnet" heet in Leerplandoelen nu "Leerplan"
- ModuleShell-invoerpanel volgt de afgeronde hoeken van de container

---

## [5.8.15] - 2026-08-30

### Changed
- Optie "Alle onderwijsniveaus" verwijderd uit de onderwijsniveau-selector
- Oude opgeslagen waarde `alle_niveaus` wordt gemigreerd naar `lager_onderwijs`

---

## [5.8.14] - 2026-08-30

### Security
- Secundaire scraper-uitvoer niet meer in git of op GitHub-releases (zip verwijderd,
  fixtures secundair verwijderd, app laadt enkel lokale `data/secundair/`)

### Changed
- `export_secundair_zip.py` leest enkel `data/secundair/` (geen fixture-fallback)

---

## [5.8.13] - 2026-08-30

### Added
- `scripts/export_secundair_zip.py` en `npm run export:secundair` voor een
  Windows-compatibele `dist/secundair_update.zip` (plat JSONL-archief + LEESMIJ.txt)
- Optioneel `--export-zip` op `fetch_secundair_full.py`

---

## [5.8.12] - 2026-08-30

### Changed
- Standaard sidebar-breedte vergroot van 256px naar 320px

---

## [5.8.11] - 2026-08-30

### Changed
- UI verwijst enkel nog naar **minimumdoelen** (geen AHOVOKS in componenten of helpteksten)
- Onderwijsniveau staat in de Zustand-store (`lager_onderwijs` als default) en wordt per account bewaard

---

## [5.8.10] - 2026-08-30

### Changed
- Gebruikersgerichte teksten spreken enkel nog over **minimumdoelen** (geen AHOVOKS)
- Standaard onderwijsniveau in Leerplandoelen en Minimumdoelen is nu **Lager onderwijs**

---

## [5.8.9] - 2026-08-30

### Added
- Resizebare desktop-sidebar met sleep-handvat aan de rechterrand
- Automatische icoon-modus wanneer de sidebar smaller dan ~140px wordt
- Dubbelklik op het handvat om ingevouwen/uitgevouwen te schakelen
- Breedte wordt per account opgeslagen in localStorage

---

## [5.8.8] - 2026-08-30

### Added
- Publieke onderwijsdoelen.be-portaalscraper als fallback zonder
  `ONDERWIJSDOELEN_API_KEY` (Playwright + robots.txt-toegestane `/doelen`-routes)
- Batch-script `scripts/fetch_secundair_full.py` en npm-script `fetch:secundair`
- Gecommitte secundaire fixture-corpus in `test/fixtures/` (SC 1-16, graden,
  finaliteiten) zodat RAG direct werkt zonder lokale data-run
- Metadatavelden `sleutelcompetentie_nr` en `sleutelcompetentie` in secundaire
  JSONL-records

### Changed
- `fetch_secondary_minimum_goals.py` valt automatisch terug op het portaal als
  geen API-key beschikbaar is of de Apigee-API faalt
- Onderwijsniveau-selector schakelt netwerkopties tussen basisonderwijs (BaO) en
  secundair onderwijs (SO) en past helpteksten aan

---

## [5.8.7] - 2026-08-30

### Added
- Live-discovery scraper for public GO!, Katholiek Onderwijs Vlaanderen and
  OVSG secondary curriculum documents
- Provider-specific PDF and Word parsers with normalized JSONL output
- Official Provinciaal Onderwijs Vlaanderen Doelenverdeler API client
- Official Vlaamse Onderwijsdoelen 1.0 API client for secondary minimum goals
- Secondary corpus loading and network filters for KOV and POV
- Parser unit tests and verified live sample runs for GO!, KOV and OVSG

### Changed
- Secondary education filtering now reads generated curriculum and minimum-goal
  corpora instead of always returning an empty result
- Curriculum source documentation expanded with access constraints, API
  endpoints and scraper commands

---

## [5.8.6] - 2026-08-30

### Added
- Onderwijsniveau-filter bij **Leerplandoelen** en **Minimumdoelen**
- Keuzes voor alle niveaus, kleuteronderwijs, lager onderwijs en secundair onderwijs
- Server-side filtering op leerjaar, fase, leeftijdsbereik en AHOVOKS-ijkpunt

### Notes
- De huidige lokale corpus bevat kleuter- en lager onderwijs. Secundair onderwijs
  toont geen basisschoolresultaten en blijft leeg tot secundaire leerplannen zijn
  geïndexeerd.

---

## [5.8.5] - 2026-08-29

### Changed
- Logout removed from the header bar; sign out is only available in **Instellingen**

---

## [5.8.4] - 2026-08-29

Account tiers, module access, and Schrijfstijl refresh.

### Added
- Invite-only account tiers (student, tester, partner, admin) with tier resolution from email and allowlists
- Daily server-side AI usage limits per tier in SQLite (`user_ai_usage`); BYOK bypasses limits
- Per-tier module access matrix; sidebar and modules hide or deny unavailable tools
- Per-account client storage scope for active lesson state and document previews (localStorage + IndexedDB)
- Account ID and **Niveau** in Settings status card
- **Schrijfstijl** module with style selector: Thomas More, Normaal, Kort, Lang
- Style-specific prompts in `/api/format-dialogue`; Thomas More Lk/Lln validation only for that style

### Changed
- Renamed **Thomas More stijl** to **Schrijfstijl** in sidebar and module UI
- Tier label shown as plain gray text (sidebar + settings) instead of badge pill
- Curriculum filter label **Alle netwerken** → **Alle leerplannen**
- Shorter default lesson-prep textarea with auto-grow cap
- Removed "via Gemini" from module descriptions and disabled-hint subtext under action buttons

### Fixed
- Voice reflection rejected browser `audio/webm;codecs=opus` recordings (MIME normalization)
- Legacy `free` tier mapped to student for AI limits and module access
- Admin tier for configured Thomas More and maintainer emails

---

## [5.8.3] - 2026-08-29

Maintenance, compliance, and security release after the audit of 2026-08-29.

### Added
- Open-source compliance files: `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`
- GitHub Actions CI (lint, typecheck, test, build)
- Committed curriculum test fixtures under `test/fixtures/` for reproducible tests without local JSONL corpora
- Zod input validation and size limits on AI endpoints (`lib/ai/inputValidation.ts`)
- Safe cookie parsing helper (`lib/auth/cookies.ts`)

### Changed
- Thomas More lesson preparation forms removed from the public repository; place templates locally in `data/templates/` (gitignored)
- Word export uses uploaded `.docx`, a local template file, or a generic generated document
- Removed em dashes from documentation and UI copy
- OVSG SSR parser migrated to ESM (`ovsg_parse_ssr.mjs`) with `JSON.parse` instead of `eval`
- Static Turbopack-safe corpus paths in `curriculumCorpus.ts`

### Fixed
- TypeScript errors in `ahovoksMinimumGoals.ts` and `curriculumCorpus.ts`
- ESLint `set-state-in-effect` violations in settings, document preview, and hooks
- UTF-8 text import in Manual Scanner (`file.text()` instead of `atob`)
- Malformed session cookies no longer cause 500 errors on logout or auth guard
- All quality gates green: lint, typecheck, 111 tests, production build

### Security
- No `eval` on external HTML in maintenance scripts
- API request body length and media-type allowlists on extract-manual and reflection routes
- Official document templates untracked via `.gitignore`

---

## [5.8.2] - 2026-08-29

Stable release. The app is a full lesson-preparation workflow for Thomas More BALO students with a shared active lesson, official curriculum RAG, and didactic quality tools.

### Added

#### Core platform
- Modular Next.js app with shared **Active lesson** context (Zustand, persisted)
- Passwordless email login via Brevo; SQLite session storage
- Account settings: profile, avatar, BYOK API keys, marketing consent, app version/build info
- Pinnable sidebar tools with persisted order
- In-app feedback form (Brevo delivery)
- Word lesson document import/export with field patching

#### Input & goals
- **Manual scanner** - AI extraction from publisher PDF/image
- **Goal optimizer** - Thomas More goal rewriting (AI)
- **MC-DAS-SPM classifier** - goal taxonomy labelling
- Dynamic D1-D12 lesson goals (hide empty slots, add with +)
- Structured **target group** selector (kindergarten → 6th grade, custom/grade class) with soft RAG ranking bonus (+0.15, never hard-filtered)

#### Curriculum RAG
- Local JSONL corpora: **ZILL**, **OVSG**, **Op.stap**, **GO! Nieuw**
- Hybrid retrieval: local token scoring + optional semantic search fallback when local matching finds nothing
- Network fallback when selected network has no matches
- Typo-tolerant query expansion (Levenshtein / fuzzy matching)
- Domain-specific token bonuses: maths, nature (OWna), reading (TOsn), history/time (OWti), PE/motor (MZgm/MZlb), ICT/media (ME/TOmn)
- Weighted stopwords so content terms dominate generic verbs
- Deep ZILL haystack indexing (learning lines + nested content)
- **Minimum goals** module: AHOVOKS codes (4th / 6th / kindergarten), numeric range ranking, top 3 results
- Official goal cards with network badge, discipline, linked minimum goal, expandable explanation
- Bold inline goal codes with spacing for all networks (Op.stap, GO! Nieuw, ZILL, …)

#### Lesson preparation modules
- Thomas More dialogue formatter
- Didactic language check
- Phase timing validation (configurable total lesson minutes)
- Goal-activity alignment audit
- Laevers engagement analysis
- Full traffic-light audit

#### After the lesson
- Voice/sketch reflection with transcription and coaching flow

#### Data pipeline scripts
- Curriculum fetch script (`scripts/fetch_curriculum_data.py`)
- Full ZILL selector scraper (`scripts/scrape_zill_full.py`)
- OVSG Leer Lokaal scraper (`scripts/scrape_ovsg_full.py`)
- Op.stap scraper (`scripts/scrape_opstap_full.py`)
- GO! Nieuw fetcher (`scripts/fetch_go_nieuw.py`)

### Fixed
- Curriculum search returning no results for common queries (e.g. multiplication, mammals, keywords)
- Minimum goal retrieval and ranking (JSONL-first, broad candidate pool, numeric/phase bonuses)
- OVSG double-encoded UTF-8 display (`Ã«` → `ë`, ellipsis/apostrophe mojibake)
- Goal code glued to title text (`3.6.GL6.14De…` → separated code + title)
- Lesson goal textarea resize/auto-grow, sidebar scroll, export download content-types

### Security
- Privacy policy consent required on login
- Third-party AI and cloud processing notice in privacy policy
- No secrets in repository; `.env.example` documents all variables

---

## Unreleased

Changes on `main` after the latest tag will appear here before the next release.
