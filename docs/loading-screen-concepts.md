# Loading screen concepten (wordmark)

Playful witte Rubik Black letters op zwart, gedeeld met `docs/assets/banner-wordmark.svg` en `lib/wordmark/letters.ts`.

## 1. Gather (geimplementeerd)

**Idee:** Letters starten verspreid in een spiraal, swingen een halve boog en snap-in op hun eindpositie.

- **Fase 1:** Scatter (golden-angle radius, willekeurige rotatie)
- **Fase 2:** Orbit (tussenpositie met lichte overshoot)
- **Fase 3:** Snap (elastic settle op wordmark-layout)
- **Stagger:** 55 ms per letter (L → s)
- **Duur:** ~1,45 s + stagger
- **Component:** `WordmarkLoader` variant `gather` in `AppLoadingScreen`

Geschikt voor: app bootstrap, dashboard hydrate, account scope laden.

## 2. Typewriter wave

**Idee:** Letters verschijnen één voor één van links naar rechts, elk met mini-bounce.

- Geen scatter; opacity 0 → 1 + `translateY(12px)` → 0
- Optioneel cursor na laatste letter
- Snelle variant (~800 ms totaal) voor korte loads

## 3. Magnetic pull

**Idee:** Letters zweven traag (CSS `@keyframes float`), dan trekken ze tegelijk naar het midden alsof een magneet aangaat.

- Eerste 600 ms: idle float ±4 px
- Dan 400 ms: `transform` naar finale posities met `ease-in`
- Goed als load soms langer duurt (geen lege spinner nodig)

## 4. Orbit lock

**Idee:** Alle letters cirkelen 1–2 s rond het middenpunt, daarna klikken ze sequentieel op hun plaats (slot-machine).

- Cirkelbaan radius ~120 px, constante snelheid
- Per letter: detach from orbit → snap (100 ms)
- Meest speels; iets zwaarder voor `prefers-reduced-motion`

## 5. Shuffle sort

**Idee:** Letters staan in verkeerde volgorde (bijv. `slootkrachtenLe`), wisselen 2–3 swaps, eindigen correct.

- Alleen horizontale beweging
- Grappig voor didactische tool; minder elegant op mobiel

## 6. Breathe hold

**Idea:** Na gather blijft het woord staan met subtiele adem-animatie (scale 1 → 1.02 → 1) tot de app klaar is.

- Combineer met variant 1
- Voorkomt flits wanneer load > animatieduur

---

## Technisch

| Bestand | Rol |
|---------|-----|
| `lib/wordmark/letters.ts` | Eindposities + scatter/orbit helpers |
| `components/shared/WordmarkLoader.tsx` | Render + variant switch |
| `components/shared/AppLoadingScreen.tsx` | Full-screen loader |
| `app/globals.css` | `@keyframes wordmark-gather` |

Nieuwe variant toevoegen: extend `WordmarkLoaderVariant`, CSS keyframes, optioneel props in `WordmarkLoader`.

`prefers-reduced-motion`: gather degradeert naar fade-in op eindpositie (geen scatter).
