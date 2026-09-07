# Leerkrachtentools v5.19.0

Juridische documenten op generativelabs.be, PostHog in de EU Cloud, een B2B curriculum-API, en een mildere favicon.

---

## Juridisch

- Login, instellingen en sidebar linken naar Voorwaarden, Privacy en Juridische informatie op generativelabs.be
- Verplichte checkbox: akkoord met de algemene voorwaarden, kennisname van het privacybeleid
- Lees het privacyoverzicht opent de privacy-pagina in een nieuw tabblad
- `/privacy`, `/voorwaarden` en `/juridisch` sturen door naar die centrale documenten

## PostHog

- EU Cloud (Frankfurt), alleen als `NEXT_PUBLIC_POSTHOG_KEY` gezet is
- Alleen identified profiles, formulierinvoer gemaskeerd in session recordings

## B2B API

- `Authorization: Bearer lt_live_...`, sleutel één keer zichtbaar, daarna SHA-256 in SQLite
- `POST /api/v1/curriculum/match`, `POST /api/v1/curriculum/audit`, `POST /api/v1/goals/improve`
- Maandelijks quota per organisatie

## Minimumdoelen

- Spelling en Wetenschap & Techniek op de volle Op.stap-catalogus (ook in v5.18.1)

## Favicon

- Milde squircle, iets kleinere gather LT

---

**Volledige changelog:** [CHANGELOG.md](https://github.com/tibodepauw/Leerkrachtentools/blob/main/CHANGELOG.md)
