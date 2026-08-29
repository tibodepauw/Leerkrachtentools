# Leerkrachtentools

Research platform to explore which AI-assisted workflows can save preparation and reflection time for teachers and teacher trainers in Flemish education.

The app bundles lesson-prep tasks into one **active lesson** context so you can compare tools, measure usefulness, and iterate on what actually reduces manual work: scanning publisher manuals, refining goals, linking official curriculum goals, formatting lesson scripts, running didactic checks, and reflecting after class.

Built for Thomas More BALO teacher training, but the modules apply to any teacher preparing structured lessons in Flanders.

## Research goal

Teachers lose time on repetitive, low-value prep steps: copying goals from manuals, checking wording against institute rules, searching curriculum documents, aligning activities with goals, and writing reflections. Leerkrachtentools tests whether AI can take over those steps **without** replacing professional judgment.

Each module is isolated enough to evaluate on its own, yet connected through shared lesson data so you can run a full workflow in one session.

## How the app is organized

### Active lesson (shared context)

Every module reads from the same persisted lesson state:

- Topic, learning area, component, materials
- Structured **target group** (kindergarten through 6th grade, or custom grade class) with optional age range
- Dynamic lesson goals **D1 to D12** (only filled goals are shown; add more with +)
- Education network preference (ZILL, OVSG, GO)
- Reference school year and total lesson minutes (default 50)
- Four phases: **Instap, Instructie, Verwerking, Afronding**
- Lesson preparation text and optional uploaded document (Word/PDF preview in browser)
- Pinned sidebar tools for quick access

Changes in one module (e.g. manual scanner, goal optimizer) propagate everywhere else immediately.

### Input

| Module | What it does |
|--------|----------------|
| **Handleiding Scanner** | Upload a PDF or image of a publisher manual. AI extracts learning area, target group, materials, and publisher goals into the active lesson. Also accepts pasted text. |
| **Actieve les** | Central hub: edit context, import/export `.docx` lesson documents, preview uploads, download an updated Word file. |

### Goals

| Module | What it does |
|--------|----------------|
| **Doelverbeteraar** | Rewrites a selected lesson goal to Thomas More formulation rules. Shows rationale and term changes. Requires AI. |
| **MC-DAS-SPM herkenner** | Classifies a goal as mental-cognitive (MC), dynamic-affective (DAS), or sensomotor/psychomotor (SPM) without rewriting it. Requires AI. |
| **Leerplandoelen** | Searches official Flemish curriculum goals from local corpora (ZILL, OVSG, Op.stap, GO! Nieuw). Typo-tolerant matching, domain bonuses (math, nature, language, history, PE, ICT), optional semantic fallback when local search finds nothing. Target group gives a soft ranking boost without hiding other results. Top 5 cards with code, discipline, linked minimum goal, and copy/add actions. |
| **Minimumdoelen** | Matches decreetal AHOVOKS minimum goals (4th grade checkpoint, 6th grade end goal, kindergarten K-codes). Numeric range awareness (e.g. "tot 20"), top 3 ranked results, same target-group soft boost. |

Curriculum search is **retrieval only** (no generative AI in the matcher itself). Results come from indexed JSONL files shipped with or built for the deployment.

### Lesson preparation

| Module | What it does |
|--------|----------------|
| **Thomas More stijl** | Converts raw instructions into Lk/Lln dialogues with italic board and organisation actions. |
| **Taalfoutencheck** | Didactic language review: dt-errors, formal instruction tone, terminology, professional wording. |
| **Timing** | Checks whether minutes across the four phases sum to the configured total lesson time; AI can suggest redistribution. |

### Quality control

| Module | What it does |
|--------|----------------|
| **Doel-activiteit** | Per goal: checks if explanation, independent practice, and evaluation are present in the preparation text. |
| **Betrokkenheid** | Laevers engagement factors: learning activity, reality proximity, initiative, climate, expression, collaborative learning. |
| **Totale audit** | Traffic-light overview across goals, curriculum fit, language, timing, alignment, and engagement. |

### After the lesson

| Module | What it does |
|--------|----------------|
| **Voice-reflectie** | Post-lesson reflection in two steps: transcribe audio or sketches, then coaching dialogue with follow-up questions before a final Page 5 style output. |

### Account and settings

- Passwordless email login (one-time code)
- Profile name and photo
- **Bring your own API key**: choose provider and model in Settings; when enabled, only your key is used
- Marketing email preference (opt-in, off by default)
- In-app feedback form (idea, feedback, bug)
- App version and build info with link to GitHub releases

## Curriculum data

Local search indexes official goal corpora:

| Network | Source |
|---------|--------|
| ZILL | Katholiek onderwijs ZILL selector (learning lines + nested content) |
| OVSG | LeerLokaal |
| Op.stap | Katholiek onderwijs Op.stap |
| GO! Nieuw | GO! basisonderwijs leerplan |

Maintenance scripts (optional, not required to run the app UI):

```bash
pip install -r scripts/requirements-curriculum.txt
python3 scripts/fetch_curriculum_data.py
python3 scripts/scrape_zill_full.py      # requires: playwright install chromium
python3 scripts/scrape_opstap_full.py
python3 scripts/fetch_go_nieuw.py
python3 scripts/scrape_ovsg_full.py        # requires OVSG credentials in env
```

See `docs/curriculum-bronnen-urls.md` for official source URLs.

Corpus files live under `data/` and are gitignored by default. Never commit scraped credentials or personal login details.

## Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local: add at least one AI provider key and auth/email settings
npm run dev -- --hostname 0.0.0.0 --port 43127
```

Open `http://127.0.0.1:43127`.

### Minimum configuration

```bash
# At least one AI provider (examples)
GROQ_API_KEY=
CEREBRAS_API_KEY=
SAMBANOVA_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# Auth (Brevo transactional email)
BREVO_API_KEY=
BREVO_FROM_EMAIL=Leerkrachtentools <login@yourdomain.be>
AUTH_SECRET=use-a-long-random-string-at-least-32-characters

# Optional
DATABASE_PATH=./data/leerkrachtentools.db
FEEDBACK_TO_EMAIL=feedback@yourdomain.be
```

Local development works without Brevo: the login API returns a visible dev code when email is not configured.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

108 automated tests cover curriculum tokenization, minimum-goal ranking, fuzzy matching, and core utilities.

## Production deployment

Next.js standalone output:

```bash
npm run build
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

Also copy `.next/static` and `public` into `.next/standalone` for a self-hosted deploy.

Keep `data/` persistent and back up `data/leerkrachtentools.db`. The SQLite database stores verified emails, hashed login codes, hashed sessions, encrypted user API key metadata, and consent flags. **Lesson preparation content stays in the browser** (persisted lesson store and IndexedDB document preview), not in the database.

## Privacy

- Privacy policy consent is required at login
- Marketing consent is off by default
- AI modules only receive text you explicitly submit for that action
- Read `/privacy` in the running app for processor details

## Documentation

| File | Description |
|------|-------------|
| [CHANGELOG.md](./CHANGELOG.md) | Version history |
| [docs/AI-en-RAG-overzicht.md](./docs/AI-en-RAG-overzicht.md) | Architecture notes (Dutch) |
| [docs/curriculum-bronnen-urls.md](./docs/curriculum-bronnen-urls.md) | Official curriculum URLs |

## Tech stack

- Next.js 16 (App Router, standalone)
- React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- Zustand (persisted active lesson)
- better-sqlite3 (auth sessions)
- Vercel AI SDK (multi-provider)
- Vitest

## Releases

Current version: **5.8.3**

See [GitHub Releases](https://github.com/tibodepauw/Leerkrachtentools/releases) and [CHANGELOG.md](./CHANGELOG.md).
