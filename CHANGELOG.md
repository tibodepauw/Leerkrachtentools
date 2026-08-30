# Changelog

All notable changes to **Leerkrachtentools** are documented here.  
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Releases: [GitHub Releases](https://github.com/tibodepauw/Leerkrachtentools/releases)

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
- Gecommitte secundaire fixture-corpus in `test/fixtures/` (SC 1–16, graden,
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
- **MC–DAS–SPM classifier** - goal taxonomy labelling
- Dynamic D1–D12 lesson goals (hide empty slots, add with +)
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
- Goal–activity alignment audit
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
