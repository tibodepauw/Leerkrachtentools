# Changelog

All notable changes to **Leerkrachtentools** are documented here.  
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Releases: [GitHub Releases](https://github.com/tibodepauw/Leerkrachtentools/releases)

## [0.1.0] — 2026-08-29

First tagged release. The app is a full lesson-preparation workflow for Thomas More BALO students with a shared active lesson, official curriculum RAG, and didactic quality tools.

### Added

#### Core platform
- Modular Next.js app with shared **Active lesson** context (Zustand, persisted)
- Passwordless email login via Brevo; SQLite session storage
- Account settings: profile, avatar, BYOK API keys, marketing consent, app version/build info
- Pinnable sidebar tools with persisted order
- In-app feedback form (Brevo delivery)
- Word lesson document import/export with field patching

#### Input & goals
- **Manual scanner** — AI extraction from publisher PDF/image
- **Goal optimizer** — Thomas More goal rewriting (Gemini)
- **MC–DAS–SPM classifier** — goal taxonomy labelling
- Dynamic D1–D12 lesson goals (hide empty slots, add with +)
- Structured **target group** selector (kindergarten → 6th grade, custom/grade class) with soft RAG ranking bonus (+0.15, never hard-filtered)

#### Curriculum RAG
- Local JSONL corpora: **ZILL**, **OVSG**, **Op.stap**, **GO! Nieuw**
- Hybrid retrieval: local token scoring + optional **Google Discovery Engine** semantic fallback
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
- Google Cloud / no-training notice in privacy policy
- No secrets in repository; `.env.example` documents all variables

---

## Unreleased

Changes on `main` after the latest tag will appear here before the next release.
