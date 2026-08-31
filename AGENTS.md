# Agent instructions

Style and release rules for this repository. Follow these in code, docs, UI copy, commits, and GitHub releases.

## No em dashes or en dashes

Do **not** use `—` (U+2014 em dash) or `–` (U+2013 en dash) anywhere in:

- User-facing UI strings
- Documentation and README
- Release titles and release notes
- Changelog entries

**Instead:**

| Context | Use |
|--------|-----|
| Release title separator | `▬` (U+25AC BLACK RECTANGLE), e.g. `v5.12.0 ▬ Wordmark loader & smart splash` |
| Mid-sentence pause in UI/docs | comma, colon, or rewrite as two sentences |
| Numeric ranges | hyphen-minus `-`, e.g. `2-3 swaps`, `250-300 ms` |

## Sentence case (never Title Case)

**Title Case** = elk woord een hoofdletter (`Wordmark Loader & Smart Splash`). Dat willen we **niet**.

**Sentence case** = alleen het **eerste woord** van de zin of ondertitel krijgt een hoofdletter, plus **eigen namen** en **acroniemen**. Alle andere woorden blijven lowercase.

| | Voorbeeld |
|---|-----------|
| ✅ sentence case | `Wordmark loader & smart splash` |
| ✅ sentence case | `Client-side RAG cache & security headers` |
| ❌ Title Case | `Wordmark Loader & Smart Splash` |
| ❌ Title Case | `Client-Side RAG Cache & Security Headers` |

Wel hoofdletter:

- Eerste woord van zin, titel of ondertitel (ook het woord direct na `▬` in release-titels)
- Eigen namen (Leerkrachtentools, Thomas More, Gemini, GitHub, …)
- Acroniemen (RAG, API, LLM, BYOK, …)

Geen hoofdletter op gewone zelfstandige naamwoorden midden in de zin (`loader`, `cache`, `sidebar`, …).

Module labels in de sidebar mogen hun bestaande productnaam houden (bv. "Handleiding Scanner") als dat de afgesproken UI-naam is.

## GitHub release titles

Every release needs a descriptive title:

```
v{version} ▬ {Short subtitle in sentence case}
```

Examples:

- `v5.12.0 ▬ Wordmark loader & smart splash`
- `v5.11.0 ▬ Client-side RAG cache & security headers`
- `v5.10.4 ▬ Lazy loading RAG corpora`

The tag stays `v5.12.0`; only the release **title** includes the subtitle after `▬`.

## Before shipping copy

Ripgrep check:

```bash
rg '[—–]' --glob '!node_modules' --glob '!.next'
```

Fix any hits before merge or release.
