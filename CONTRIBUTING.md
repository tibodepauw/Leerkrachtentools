# Contributing

Thank you for helping improve Leerkrachtentools. This project is open source under the [MIT License](./LICENSE) and aims to research which AI-assisted workflows save preparation time for teachers in Flemish education.

Contributions from fellow Thomas More BALO students, teachers, and external collaborators are welcome, especially for:

- Curriculum corpus parsers and scrapers (`scripts/`, `data/`)
- Didactic analysis modules (`components/modules/`, `app/api/`, `lib/`)
- Retrieval and ranking logic for official goals (`lib/rag/`)

## Before you start

1. Fork the repository and work on a feature branch from `main`
2. Keep changes focused: one logical improvement per pull request
3. Do not commit API keys, passwords, personal data, or scraped credentials
4. Run the checks below before opening a PR

## Development setup

```bash
npm install
cp .env.example .env.local
npm run dev -- --hostname 0.0.0.0 --port 43127
```

Configure `.env.local` locally for AI and email features you need to test. Never commit that file.

## Quality checks

Run these from the project root:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` runs **108 automated tests** (Vitest), including curriculum tokenization, minimum-goal ranking, fuzzy matching, and core utilities. All tests must pass before merge.

`npm run lint` uses ESLint with the Next.js config. Fix new warnings in files you touch.

## Didactic context (Thomas More)

Several modules encode Thomas More teacher-training conventions. When changing goal-related logic, keep these in mind:

### Lesson goal formulation (Doelverbeteraar)

Goals should follow institute rules: feasible for the target group, observable, and phrased as **"De leerlingen kunnen …"** where appropriate. The optimizer rewrites publisher text toward that standard without changing the underlying learning intention.

### MC, DAS, SPM taxonomy (MC-DAS-SPM herkenner)

Goals are classified without rewriting:

| Code | Meaning |
| ---- | ------- |
| **MC** | Mental-cognitive (knowing, understanding, applying knowledge) |
| **DAS** | Dynamic-affective (attitudes, motivation, social-emotional aspects) |
| **SPM** | Sensomotor / psychomotor (physical skills, movement, manipulation) |

### Thomas More dialogue format (Thomas More stijl)

Lesson scripts use **Lk** (teacher) and **Lln** (pupils) lines. Board work and organisation actions appear in *italic*.

### Curriculum alignment

- **Leerplandoelen**: official Flemish curriculum goals (ZILL, OVSG, Op.stap, GO! Nieuw)
- **Minimumdoelen**: decreetal AHOVOKS checkpoints (4th grade, 6th grade end goal, kindergarten K-codes)

Changes to search ranking should preserve soft target-group boosting and must not hard-filter results by age or grade.

## Working on parsers and corpus data

Official curriculum sources are documented in [docs/curriculum-bronnen-urls.md](./docs/curriculum-bronnen-urls.md).

- Output JSONL files belong under `data/` and are gitignored by default
- Python scripts live in `scripts/`; install deps with `pip install -r scripts/requirements-curriculum.txt`
- Never commit OVSG credentials or other login details

## Pull request checklist

- [ ] Branch is up to date with `main`
- [ ] `npm run lint`, `npm test`, and `npm run build` succeed
- [ ] No secrets or personal emails in the diff
- [ ] README or docs updated if behaviour changed
- [ ] New tests added when fixing bugs or adding ranking/parser logic

## Questions

Open a [GitHub Discussion](https://github.com/tibodepauw/Leerkrachtentools/discussions) for design questions, or use the in-app feedback form for UX ideas.

Security issues: see [SECURITY.md](./SECURITY.md).
