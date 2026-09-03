# Loading screen concepten (wordmark)

Playful Rubik Black letters on black, with the huisstijl dotted grid. Shared with `docs/assets/banner-wordmark.svg` and `lib/wordmark/letters.ts`.

**Status:** Gather is live via `LoadingGate` on eerste site-load (volledige animatie ~2,5 s). Snelle navigatie (bv. instellingen) toont geen wordmark; alleen bij trage loads een kleine spinner na 320 ms. Andere varianten: Instellingen → Laadscherm.

## Preview

Open lokaal: [http://localhost:43123/dev/wordmark-loader](http://localhost:43123/dev/wordmark-loader) (poort kan afwijken).

## 1. Gather

**Idee:** Letters starten verspreid in een spiraal, swingen een halve boog en snap-in op hun eindpositie.

- **Fase 1:** Scatter (golden-angle radius, willekeurige rotatie)
- **Fase 2:** Orbit (tussenpositie met lichte overshoot)
- **Fase 3:** Snap (elastic settle op wordmark-layout)
- **Stagger:** 55 ms per letter (L → s)
- **Duur:** ~1,45 s + stagger

## 2. Typewriter wave

**Idee:** Letters verschijnen één voor één van links naar rechts, elk met mini-bounce.

- Geen scatter; opacity 0 → 1 + `translateY(12px)` → 0
- Snelle variant (~800 ms totaal) voor korte loads

## 3. Magnetic pull

**Idee:** Letters zweven traag, dan trekken ze tegelijk naar het midden alsof een magneet aangaat.

- Eerste ~600 ms: idle op scatter-posities
- Daarna: `transform` naar finale posities met `ease-in`

## 4. Orbit lock

**Idee:** Alle letters cirkelen rond het middenpunt, daarna klikken ze sequentieel op hun plaats.

- Cirkelbaan radius ~6 em
- Per letter: snap met stagger (~90 ms)

## 5. Shuffle sort

**Idee:** Letters staan in verkeerde volgorde, wisselen 2-3 swaps, eindigen correct.

- Alleen horizontale beweging (via slot-posities)
- Grappig voor didactische tool; minder elegant op mobiel

## 6. Breathe hold

**Idee:** Woord fade-in op eindpositie, daarna subtiele adem-animatie (scale 1 → 1.025 → 1) in loop.

- Combineerbaar met variant 1 als intro
- Voorkomt flits wanneer load > animatieduur

---

## Technisch

| Bestand | Rol |
|---------|-----|
| `lib/wordmark/letters.ts` | Eindposities + scatter/orbit/shuffle helpers |
| `components/shared/WordmarkLoader.tsx` | Render + variant switch |
| `app/dev/wordmark-loader/page.tsx` | Preview om te kiezen |
| `app/globals.css` | `@keyframes wordmark-*` |
| `components/shared/AppLoadingScreen.tsx` | Nog spinner; pas aan na goedkeuring |

Nieuwe variant toevoegen: extend `WordmarkLoaderVariant`, CSS keyframes, entry in `WORDMARK_LOADER_VARIANTS`.

`prefers-reduced-motion`: animaties degraderen naar fade-in op eindpositie.
