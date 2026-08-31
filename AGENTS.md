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
| Release title separator | `▬` (U+25AC BLACK RECTANGLE), e.g. `v5.12.0 ▬ wordmark loader & smart splash` |
| Mid-sentence pause in UI/docs | comma, colon, or rewrite as two sentences |
| Numeric ranges | hyphen-minus `-`, e.g. `2-3 swaps`, `250-300 ms` |

## Sentence case only (never Title Case)

Headings, release titles, button labels, and descriptions use **sentence case**:

- ✅ `wordmark loader & smart splash`
- ✅ `client-side RAG cache & security headers`
- ❌ `Wordmark Loader & Smart Splash`
- ❌ `Client-Side RAG Cache & Security Headers`

Capitalize only:

- The first word of a sentence or title fragment
- Proper nouns (Leerkrachtentools, Thomas More, Gemini, GitHub, …)
- Acronyms (RAG, API, LLM, BYOK, …)

Module names in the sidebar may keep their established casing (e.g. "Handleiding Scanner") when that is the product label.

## GitHub release titles

Every release needs a descriptive title:

```
v{version} ▬ {short subtitle in sentence case}
```

Examples:

- `v5.12.0 ▬ wordmark loader & smart splash`
- `v5.11.0 ▬ client-side RAG cache & security headers`
- `v5.10.4 ▬ lazy loading RAG corpora`

The tag stays `v5.12.0`; only the release **title** includes the subtitle after `▬`.

## Before shipping copy

Ripgrep check:

```bash
rg '[—–]' --glob '!node_modules' --glob '!.next'
```

Fix any hits before merge or release.
