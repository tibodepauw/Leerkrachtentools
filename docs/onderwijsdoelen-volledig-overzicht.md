# Onderwijsdoelen.be: volledig overzicht Vlaamse onderwijsdomeinen

## Aanvulling: OVSG-toegang op 13 november 2026

Schooltoegang voor de nieuwe OVSG-portalen voor basis- en secundair onderwijs is bevestigd. Op expliciete vraag is een afzonderlijke rustige accountverzameling gebouwd en uitgevoerd voor de aangeboden basiseditie **2027-2028**. Alle negen leergebieden en 129 leerlijnen leveren exact **3937 leerplandoelen**, met daarnaast **5463 ondersteuningsdoelen** en **2017 verdiepingsdoelen**. Alle relatieverwijzingen zijn opgelost; bron-HTML, entiteitvarianten en grafen zijn lokaal bewaard. De bestaande app doorzoekt de nieuwe editie met het schooljaar zichtbaar. Daarmee zijn **19719 actieve centrale doelrecords in elf datasets** beschikbaar. Ondersteuning en verdieping tellen niet nogmaals mee als centrale doelen.

Ook de vijf aangeboden secundaire accountleerplannen zijn nu compleet verzameld: **4341 centrale doelen uit 320 leerlijnen**. De zelfstandige dataset `OVSG_SECUNDAIR_2025` is lokaal doorzoekbaar. Daarmee zijn **24060 centrale apprecords in twaalf datasets** beschikbaar. Dit zijn broncontexten uit meerdere netwerken en doelensets, geen telling van unieke leerinhouden en geen rechtstreeks vergelijkbaar totaal met de historische overheidscensus.

Het aparte updateportaal voor 2026-2027 accepteert het geteste basisaccount niet. De nieuwe collecties bewijzen dus geen dekking van die editie of van alle secundaire graden en koepels. De publieke crawler houdt zijn robotsbeleid; de afzonderlijke accountworkflows lezen alleen de aangeboden gewone leerplanpagina's. Wachtwoorden staan niet in de repository. De onderstaande aantallen en constatering over ontbrekende inloggegevens beschrijven de eerdere stand van 12 november.

## Gecontroleerde stand op 12 november 2026

De lokale volledige API-bronkopie van **11 november 2026** bevat **24019 bronrecords**. Daarvan zijn 12079 door de bron als geldig aangeduid, 9863 niet meer geldig en 2077 met onbekende geldigheid. Alle records blijven bewaard in `data/corpus/catalog.sqlite3`, tabel `source_records`. Alleen de geldig aangeduide records binnen hun datumbereik gaan naar de actieve overheidsexports.

De app heeft daarnaast 3490 GO!-nieuwe doelrecords en 213 generieke ZILL-doelen met 1218 opgeslagen ontwikkelstappen. Daardoor staan nu **15782 actieve doelrecords in tien datasets** klaar. Een generiek doel met meerdere ontwikkelstappen telt hierbij als één doelrecord. Dit is geen volledige verzameling van alle koepelleerplannen.

Het hieronder genoemde totaal van 24571 is een historische documentatieclaim uit augustus 2026. De oorspronkelijke volledige bronrecords achter dat getal zijn hier niet beschikbaar. Het verschil van 552 met de bronkopie van november is daarom niet op recordniveau verklaard. De historische domeinaantallen zijn geen actuele acceptatienorm.

Nog ontbrekend in de actieve publicatie:

- **OVSG basisonderwijs:** inloggegevens ontbreken lokaal. De nieuwe handmatige adapter ondersteunt nog geen ingelogde import en stopt expliciet. Een toegestane export of aanvullende integratie is nodig; credentials toevoegen is op zichzelf niet voldoende.
- **POV:** de officiële API-sleutel ontbreekt lokaal.
- **Op.stap:** de bekende bulk-API sluit automatisch ophalen uit. Een ontbrekende login is niet als oorzaak vastgesteld.
- **GO! oud:** de gescande wiskunde-PDF blokkeert volledige normalisatie, geen loginprobleem.
- **Secundaire leerplannen:** een defecte officiële KOV-bronlink blokkeert de gezamenlijke dataset, geen vastgesteld loginprobleem. De audit van 4 oktober noemt bovendien niet volledig gevalideerde KOV-uitbreidingsdoelen; volledige documentdekking is niet bewezen.

Zie de [handmatige onderhoudshandleiding](curriculum-handmatig-vernieuwen.md) en de [actuele broningangen](curriculum-bronnen-urls.md). Er zijn geen automatische controles ingepland. Voor de onderwijsdoelenroute wordt de publieke portaalconfiguratie gebruikt; een persoonlijke `ONDERWIJSDOELEN_API_KEY` ontbreekt, maar is voor die route niet nodig.

## Historisch brononderzoek: augustus 2026

Onderstaande routes, aantallen en categorieën komen uit het oudere onderzoek. Ze bewijzen geen actuele beschikbaarheid of volledigheid.

## Bronnen

| Bron | URL | Toegang |
|------|-----|---------|
| Onderwijsdoelen portaal | https://www.onderwijsdoelen.be/ | Publiek (Angular SPA) |
| Onderwijsdoelen API | https://onderwijs.api.vlaanderen.be/onderwijsdoelen/ | `ONDERWIJSDOELEN_API_KEY` (niet in git) |
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
