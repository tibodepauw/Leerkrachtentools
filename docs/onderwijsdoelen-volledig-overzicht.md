# Onderwijsdoelen.be: volledig overzicht Vlaamse onderwijsdomeinen

Documentatie gegenereerd op basis van portaal- en API-onderzoek (augustus 2026).

## Bronnen

| Bron | URL | Toegang |
|------|-----|---------|
| Onderwijsdoelen portaal | https://www.onderwijsdoelen.be/ | Publiek (Angular SPA) |
| Onderwijsdoelen API | https://onderwijs.api.vlaanderen.be/onderwijsdoelen/ | `x-api-key` header (publieke key in `env.js`) |
| Onderwijsdoelen API 1.0 (Apigee) | https://onderwijs-vlaanderen-portaalov.apigee.io/ | `ONDERWIJSDOELEN_API_KEY` (optioneel) |
| KOV BuBaO curriculum | https://pro.katholiekonderwijs.vlaanderen/curriculum-bubao/ | Publieke leerplannen |
| Secundair leerplannen | GO!, KOV, OVSG, POV | Zie `docs/curriculum-bronnen-urls.md` |

## Portaal-routes (filterpagina's)

Deze routes laden filtermetadata via `/onderwijsdoelen/filters/{route}`:

| Route | Domein |
|-------|--------|
| `/doelen/OKAN` | Onthaalonderwijs (OKAN) |
| `/doelen/BUBAO` | Buitengewoon basisonderwijs |
| `/doelen/BUSO_OV1` | BuSO opleidingsvorm 1 |
| `/doelen/BUSO_OV2` | BuSO opleidingsvorm 2 |
| `/doelen/BUSO_OV3` | BuSO opleidingsvorm 3 |
| `/doelen/DKO` | Deeltijds kunstonderwijs |
| `/doelen/VO` | Volwassenenonderwijs |
| `/doelen/HOGER` | Hoger onderwijs (lerarenopleiding) |

## Concrete doelensets (portal datasets)

Extractie uit de Angular-bundle (`chunk-GWABYQ5Y.js`). Elke set is bereikbaar via `https://www.onderwijsdoelen.be/doelen/{DATASET_ID}`.

### OKAN
- `OKAN_V1_0` (25 doelen)

### BuBaO (via API-classificatie)
Geen aparte portal-set-ID; doelen worden gefilterd op `onderwijsniveau=Basisonderwijs` + `onderwijssoort=Buitengewoon`.
Types in doelensetnaam: Basisaanbod, Type 1, Type 2, Type 3, Type 4, Type 6, Type 7, Type 9.

### BuSO
- `BSO_OV1`, `BSO_OV2`, `BSO_OV3`, `BSO_OV_1_3`
- OV4-deelsets (`BSO_*_OV4_*`) worden geclassificeerd als gewoon secundair (regulier SO)

### DKO
- `DKO_1STE_GRAAD`, `DKO_1STE_GRAAD_V1_0`
- `DKO_2DE_GRAAD`, `DKO_2DE_GRAAD_V1_0`
- `DKO_3DE_GRAAD`, `DKO_3DE_GRAAD_V1_0`
- `DKO_4DE_GRAAD`, `DKO_4DE_GRAAD_V2_0`, `DKO_4DE_GRAAD_V2_1`

Disciplines: Beeld, Muziek, Woordkunst-drama, Dans (afgeleid uit doelensetnaam).

### Volwassenenonderwijs
- `BASIS_EDU` (Basiseducatie)
- Secundair volwassenenonderwijs/CVO: gefilterd via `onderwijsniveau=Volwassenenonderwijs`

### Hoger onderwijs
- `LERAREN_OPL` (basiscompetenties en DLR's lerarenopleiding)

### Gewoon secundair (bestaand)
- `SO_1STE_GRAAD_V2_1`, `SO_2DE_GRAAD_V2_1`, `SO_3DE_GRAAD_V2_1`, enz.

## API-structuur

```
GET /onderwijsdoelen/onderwijsdoel?paginanr={n}&rijen_per_pagina={m}
Header: x-api-key: {key}
```

Totaal: **24.571** onderwijsdoelen (augustus 2026). Paginatie via `paginanr` en `rijen_per_pagina` (max 500).

Elk record bevat:
- `code`, `omschrijving`, `onderwijsdoel_type`
- `onderwijsdoelenset.onderwijsdoelenset` (naam)
- `onderwijsdoelenset.onderwijsstructuur` (niveau, soort, graad, opleidingsvorm, stroom)
- `onderwijsdoelenset.vlaamse_sleutelcompetentie` (indien van toepassing)

## Uniform JSONL-schema (platform)

```json
{
  "code": "07.01",
  "discipline": "Burgerschapscompetenties ...",
  "graad": "1ste graad | OV1 | Type 2 | 4de graad DKO",
  "finaliteit": "Doorstroom | NT2 | Ontwikkelingsdoel | OV2",
  "titel": "De leerlingen ...",
  "toelichting": "Didactische toelichting",
  "netwerk": "AHOVOKS",
  "onderwijsniveau": "BUBAO | BUSO | OKAN | DKO | VOLWASSENEN | HOGER | SECUNDAIR",
  "bron_url": "https://www.onderwijsdoelen.be/doelen/..."
}
```

## Output in dit project

| Domein | JSONL | GCS export |
|--------|-------|------------|
| OKAN | `data/okan/onderwijsdoelen_okan.jsonl` | `data/okan/gcs/onderwijsdoelen_okan.txt` |
| BuBaO | `data/bubao/onderwijsdoelen_bubao.jsonl` | `data/bubao/gcs/...` |
| BuSO | `data/buso/onderwijsdoelen_buso.jsonl` | `data/buso/gcs/...` |
| DKO | `data/dko/onderwijsdoelen_dko.jsonl` | `data/dko/gcs/...` |
| Volwassenen | `data/volwassenen/onderwijsdoelen_volwassenen.jsonl` | `data/volwassenen/gcs/...` |
| Hoger | `data/hoger/onderwijsdoelen_hoger.jsonl` | `data/hoger/gcs/...` |

## Doelen per categorie (augustus 2026)

| Domein | Aantal doelen |
|--------|---------------|
| OKAN | 25 |
| BuBaO | 4.053 |
| BuSO (OV1/OV2/OV3) | 680 |
| DKO | 301 |
| Volwassenenonderwijs | 2.623 |
| Hoger onderwijs (lerarenopleiding) | 385 |
| **Totaal nieuwe domeinen** | **8.067** |

Daarnaast: gewoon secundair + basisonderwijs via bestaande scrapers (`data/secundair/`, `data/opstap/`, enz.).

## Koepelbronnen BuBaO/BuSO

BuBaO-ontwikkelingsdoelen zijn deels beschikbaar via onderwijsdoelen.be (AHOVOKS). Aanvullende koepel-leerplannen:

- **KOV**: https://pro.katholiekonderwijs.vlaanderen/curriculum-bubao/
- **GO!/OVSG**: geen aparte machine-readable BuBaO-API gevonden; leerplannen via PDF/Word (toekomstige uitbreiding scraper).

BuSO OV1/OV2/OV3-doelen zijn volledig via AHOVOKS API. OV4 volgt het reguliere secundair leerplan.

## Scripts

```bash
npm run fetch:all                              # Volledige fetch
npm run fetch:domains                          # Alleen OKAN t/m HO
npm run fetch:secundair                        # Secundair leerplannen + minimumdoelen
python3 scripts/fetch_onderwijsdoelen_domains.py
python3 scripts/fetch_secundair_full.py
```
