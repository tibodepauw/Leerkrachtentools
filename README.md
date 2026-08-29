# Leerkrachtentools

A modular Next.js lesson-preparation assistant for Thomas More BALO teacher-training students. One **active lesson** context flows through every tool: scan a publisher manual, refine goals, match official curriculum and minimum goals, format in Thomas More style, run didactic quality checks, and reflect after the lesson.

**Repository:** [github.com/tibodepauw/Leerkrachtentools](https://github.com/tibodepauw/Leerkrachtentools)

## Features

### Input
- **Manual scanner** — upload a PDF or image; AI extracts learning area, target group, materials, and publisher goals into the shared lesson state.
- **Active lesson** — central hub for topic, structured target group (grade/age), D1–D12 goals, lesson phases, Word import/export, and preparation text.

### Goals
- **Goal optimizer** — rewrites lesson goals to Thomas More standards (Google Gemini required).
- **MC–DAS–SPM classifier** — labels goals as mental-cognitive, dynamic-affective, or sensomotor/psychomotor without rewriting them.
- **Curriculum goals** — hybrid search over official Flemish curriculum corpora (ZILL, OVSG, Op.stap, GO! Nieuw) with typo tolerance, domain bonuses, and optional Google Discovery Engine fallback.
- **Minimum goals** — matches decreetal AHOVOKS minimum goals (4th grade checkpoint, 6th grade end goal, kindergarten K-codes) with numeric range ranking and soft target-group boosting.

### Lesson preparation
- **Thomas More dialogue formatter** — converts raw instructions into Lk/Lln dialogues with italic board/organisation actions.
- **Language check** — didactic spellcheck: dt-errors, formal instruction language, terminology, professional tone.
- **Timing check** — validates that minutes across the four lesson phases sum to the configured total lesson time.
- **Goal–activity alignment** — checks per goal whether explanation, independent practice, and evaluation are present.
- **Engagement analysis** — Laevers engagement factors (learning activity, reality proximity, initiative, climate, expression, collaborative learning).
- **Full audit** — traffic-light score across goals, curriculum alignment, language, timing, alignment, and engagement.

### After the lesson
- **Voice reflection** — two-phase post-lesson reflection: transcribe recording/sketches, then coaching with follow-up questions before final output.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev -- --hostname 0.0.0.0 --port 43127
```

Open `http://127.0.0.1:43127`.

AI keys are optional for most modules. Without keys the app uses deterministic local demo responses — except **Goal optimizer** and **MC–DAS–SPM classifier**, which require a Google AI Studio key:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your-key-from-aistudio.google.com
GOOGLE_MODEL=gemini-2.5-flash-lite
```

Other providers (Groq, Cerebras, …) remain optional fallbacks. Users can also add their own API keys in **Settings**.

### Email authentication (Brevo)

Local development works without Brevo using a visible dev code. For production set:

```bash
BREVO_API_KEY=your-api-key
BREVO_FROM_EMAIL=Leerkrachtentools <login@yourdomain.be>
AUTH_SECRET=a-long-random-string-at-least-32-characters
```

Verification codes are sent via `POST https://api.brevo.com/v3/smtp/email` (transactional API).

If **Block unauthorized IP addresses** is enabled for your Brevo API key, add your server’s public IP under **Security → Authorized IPs**.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Production deployment

The production build uses Next.js `output: "standalone"`:

```bash
npm run build
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

For a standalone deployment also copy `.next/static` and `public` into the matching paths under `.next/standalone`.

Keep `data/` persistent and back up `data/leerkrachtentools.db` regularly. This SQLite database stores verified email addresses, optional marketing consent, hashed login codes, and hashed sessions. Lesson preparation content is **not** stored in the database.

## Curriculum data (RAG)

Official curriculum JSONL corpora power local search. Optional scripts fetch or scrape fresh data:

```bash
pip install -r scripts/requirements-curriculum.txt
python3 scripts/fetch_curriculum_data.py
```

Downloads land in `data/{zill,go,ovsg,minimumdoelen}/`. See `docs/curriculum-bronnen-urls.md` for source URLs. Set `ONDERWIJSDOELEN_API_KEY` optionally for JSON export via the Onderwijsdoelen API.

**Full ZILL selector** (learning lines + nested content):

```bash
python3 -m playwright install chromium
python3 scripts/scrape_zill_full.py
```

Output: `data/zill/zill_volledig.jsonl`, metadata sidecar, and `zill_scrape_report.json`.

**OVSG Leer Lokaal** (Basic / Support / Extension per phase):

```bash
export OVSG_LEERLOKAAL_USER=your-username
export OVSG_LEERLOKAAL_PASSWORD=your-password
python3 scripts/scrape_ovsg_full.py
```

Output: `data/ovsg/ovsg_volledig.jsonl`. Never commit credentials.

**Op.stap** and **GO! Nieuw**:

```bash
python3 scripts/scrape_opstap_full.py
python3 scripts/fetch_go_nieuw.py
```

Output: `data/opstap/opstap_volledig.jsonl` and `data/go_nieuw/go_nieuw_volledig.jsonl`.

### Optional: Google Discovery Engine

For semantic fallback when local token matching finds no results, configure in `.env.local`:

```bash
GOOGLE_PROJECT_ID=
GOOGLE_LOCATION=global
GOOGLE_DATA_STORE_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
```

## Documentation

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](./CHANGELOG.md) | Version history and release notes |
| [docs/AI-en-RAG-overzicht.md](./docs/AI-en-RAG-overzicht.md) | AI and RAG architecture overview (Dutch) |
| [docs/curriculum-bronnen-urls.md](./docs/curriculum-bronnen-urls.md) | Official curriculum source URLs |

## Privacy & security

- Marketing consent is off by default and can be withdrawn after login.
- Never commit account passwords or API keys; use `.env.local` only.
- Review privacy policy, retention periods, and mailing unsubscribe links before public launch.

## Tech stack

- **Next.js 16** (App Router, standalone output)
- **React 19**, **TypeScript**, **Tailwind CSS 4**, **shadcn/ui**
- **Zustand** (persisted active lesson state)
- **better-sqlite3** (auth/session storage)
- **Vercel AI SDK** (multi-provider AI)
- **Vitest** (108 tests)

## Releases

See [GitHub Releases](https://github.com/tibodepauw/Leerkrachtentools/releases) and [CHANGELOG.md](./CHANGELOG.md).
