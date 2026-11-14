# Leerplanbronnen handmatig vernieuwen

Er zijn geen timers, geplande taken of automatische updates. Een update start uitsluitend na een handmatige opdracht. De verzameling bevat officiële bronkopieën, een doorzoekbare SQLite-catalogus en compacte JSONL-bestanden voor de bestaande app. De data blijven lokaal en staan buiten Git.

## Gebruik

Vereist: Python 3.11 of hoger met SQLite/FTS5 en `uv` of een werkende `venv`/`pip`. Node voert de npm-ingangen uit. De ingelogde OVSG-decoder gebruikt ook de vastgepinde `acorn` uit de gewone repo-installatie (`npm ci`, inclusief ontwikkelafhankelijkheden). Corpussetup installeert alleen Python-pakketten in een eigen omgeving, geen systeempakketten of browser.

```bash
npm run corpus:setup
npm run fetch:all
```

De geteste afhankelijkheden staan vast in `scripts/requirements-corpus.lock`, inclusief downloadhashes. Setup is een afzonderlijke expliciete stap. De gebruikelijke locatie is `~/.cache/agent-werk/leerkrachtentools-corpus/venv`. `CURRICULUM_PYTHON` kiest een bestaande interpreter en `CURRICULUM_WORK_DIR` verplaatst de werkmap. De downloadcache is afzonderlijk te kiezen met `--cache-dir`.

```bash
# Inventaris zonder netwerk, installatie of databasewijzigingen
npm run fetch:all -- --list

# Eén bron of een groep
npm run fetch:all -- --datasets GO_NIEUW ZILL
npm run fetch:domains
npm run fetch:secundair

# Bestaande gecontroleerde bronkopieën herverwerken, zonder nieuwe broncontrole
npm run fetch:all -- --offline --datasets GO_NIEUW

# Een onderbroken batch handmatig voortzetten met gecontroleerde bronnen van het laatste uur
npm run fetch:all -- --resume

# Alleen lokale integriteit controleren
npm run corpus:verify

# JSONL herstellen vanuit de canonieke catalogus, zonder netwerk
npm run corpus:export -- --datasets GO_NIEUW
```

De Python-ingang is `scripts/refresh_curriculum.py`. `scripts/fetch_all_curriculum.py` verwijst naar dezelfde implementatie. De oude losse scripts zijn behouden voor compatibiliteit en bronformaatonderzoek. Sommige daarvan hebben ouder installatie-, fallback- of publicatiegedrag. De nieuwe npm-ingangen gebruiken ze niet als batchprocessen.

Exitcodes: 0 als alle geselecteerde datasets klaar of ongewijzigd zijn, 1 als een bron ontbreekt, mislukt of afzonderlijk aangemeld moet worden vernieuwd en 2 bij een gelijktijdige update. De publieke batch meldt voor `OVSG_BAO_2027_2028` `manual_refresh_required` en behoudt de laatste goede datasetstatus en broncontroletijd. Een mislukte bron houdt andere geselecteerde bronnen niet tegen. De secundaire leerplannen vormen momenteel één gezamenlijke dataset: een onvolledige GO/KOV/OVSG-inventaris wordt niet als compleet gepubliceerd.

## Opslag en herstel

| Locatie | Betekenis |
| --- | --- |
| `data/corpus/catalog.sqlite3` | Canonieke doelen, providergegevens, bronverwijzingen en FTS5-zoekindex |
| `data/corpus/sources/<sha256>.gz` | Verliesloos gecomprimeerde oorspronkelijke bronbestanden, onafhankelijk van de tijdelijke downloadcache; SHA256 betreft de oorspronkelijke bytes |
| `data/corpus/snapshots/<sha256>.jsonl.gz` | Onveranderlijke gecomprimeerde versies van gevalideerde doelrecords |
| `data/corpus/inventories/<dataset>.json` | Ontdekte volledige broninventaris, ook als verwerking daarna faalt |
| `data/corpus/manifest.json` | Laatste run, alle datasetstatussen, aantallen en foutredenen |
| `data/<bron>/*.jsonl` | Compacte UTF-8-uitvoer op de bestaande apppaden |
| `~/.cache/agent-werk/leerkrachtentools-corpus/http/` | Herbruikbare HTTP-downloadcache met ETag, Last-Modified en inhoudshashes |

De catalogus bewaart alle provider-specifieke velden. Elk doel krijgt een stabiele `corpus_id`, datasetnaam en schemaversie. Identiteit omvat de broncontext, niet alleen een doelcode: dezelfde code kan in verschillende doelensets, graden of bijlagen voorkomen. De oorspronkelijke volledige bronnen blijven bewaard. De app leest JSONL en heeft voor zoeken geen Pythonproces of scraper nodig.

De standalone appbuild sluit `data/corpus` uit. De onderhoudscatalogus en ruwe bronarchieven worden niet met de app verpakt. Alleen de voor de app gebruikte doelbestanden horen bij een afzonderlijk gecontroleerde installatie.

AHOVOKS krijgt daarnaast een volledige querybare bronsnapshot in `source_records`. Ook vervallen, toekomstige en doelen met onbekende geldigheid blijven daar beschikbaar met hun officiële oorspronkelijke JSON, bron-URL en SHA256. De actieve exports nemen alleen doelen op die de bron expliciet geldig noemt en die binnen hun geldigheidsdatums vallen. Een datumgrens wijzigt de actieve selectie ook als de API-inhoud zelf ongewijzigd blijft.

`checked_at` beschrijft het oudste echte controlemoment van de gebruikte bronnen. `succeeded_at` is het moment waarop de dataset is gepubliceerd. `last_attempt_at` beschrijft de laatste poging. Offline verwerken ververst geen broncontrolemoment. Een fout verandert een bestaande bruikbare export niet in verse data.

Bewaar voor een volledige backup de hele `data/corpus`-map plus de JSONL-uitvoer. Oude snapshots worden niet automatisch verwijderd. Ruim historische versies alleen op na een bewuste bewaarkeuze. De werkcache kan worden verwijderd; duurzame bronbestanden en de catalogus blijven in het project. Een ontbrekende HTTP-cache wordt per benodigde bron uit het gecontroleerde gecomprimeerde archief hersteld. Ook offline herverwerken blijft daardoor mogelijk. Het oorspronkelijke controlemoment blijft behouden.

## Volledigheid en edities

Een geslaagde download is geen bewijs dat een leerplan actueel of inhoudelijk volledig is. `coverage.complete` betekent dat de verwachte broninventaris is doorlopen en de controles van die adapter zijn geslaagd. Het is geen onafhankelijke onderwijskundige acceptatie van elke PDF-extractie. Controleer het specifieke bereik in `coverage` en de broneditie.

- **GO! nieuw:** twaalf officieel aangeboden Excel-doelensets. Iedere doelzin-rij wordt geteld en vergeleken met de uitvoer. Alle niet-lege broncellen blijven behouden. Visietekst-PDF's worden afzonderlijk als broncontext bewaard. Goedkeuring wordt niet afgeleid uit een verouderde toelichting op een webpagina.
- **GO! oud:** afzonderlijke oude editie. Hoofdleerplannen staan los van overzichten, cahiers, algemene delen en bijlagen. Die laatste blijven broncontext. Een scan zonder tekstlaag blokkeert normalisatie tot een gecontroleerde OCR of officiële tekstexport beschikbaar is.
- **ZILL:** alle doelen uit de publieke veld- en thema-inventaris met zichtbare inhoud en leeftijdslijnen. Alternatieve AN- en BuBaO-weergaven zijn niet afzonderlijk gevalideerd en gelden niet als bewezen volledige dekking.
- **AHOVOKS:** alle API-pagina's moeten samen exact het officiële totaal opleveren. Herhaalde pagina's, overlappende bronidentiteiten, onbekende nieuwe geldigheidstypen of ongeclassificeerde actuele onderwijsniveaus stoppen publicatie. De publieke portaalconfiguratie wordt actueel ontdekt. Er is voor deze route geen persoonlijke API-key nodig.
- **Secundaire leerplannen:** volgt de werkelijk gelinkte documenten vanuit GO!, KOV en OVSG. Grade/finality/stream en broneditie blijven gescheiden. Aangeboden edities worden niet op basis van hun linkvolgorde als wettelijk geldig aangemerkt. Onleesbare documenten of ontbrekende vakken blokkeren vervanging van de gezamenlijke dataset.
- **OVSG nieuw basisonderwijs:** afzonderlijke ingelogde verzameling van de aangeboden editie 2027-2028, met negen leergebieden. Het overzicht bepaalt het verwachte aantal leerlijnen en elke vakinventaris het exacte doeltotaal per leerlijn. Ontbrekende doelen, bronentiteiten en dubbele eigenaarstoewijzingen stoppen publicatie. Alle oorspronkelijke doelvelden, ondersteuning, verdieping, minimumdoelkoppelingen, samenhang, kettingen en relatiegrafen blijven bewaard. Externe media worden niet afzonderlijk gedownload; HTML en mediareferenties blijven behouden.
- **Op.stap, oudere OVSG-edities en POV:** toegang kan ontbreken. Er wordt geen voorbeeldcorpus, oude snapshot of publieke visietekst als volledig leerplan gepubliceerd.

## Toegang en grenzen

### Officiële OVSG-export voor secundair onderwijs

De afzonderlijke volledige accountverzameling is ingericht via `npm run fetch:ovsg-secundair`. Op 13 november zijn alle vijf aangeboden eerste-graadleerplannen van broneditie 2025 gecontroleerd verzameld: **4341 centrale doelen uit 320 leerlijnen en 53 indelingen**, met 379 oorspronkelijke bronpagina's. De inventaris komt exact overeen met de door de bron opgegeven aantallen. De eerdere officiële selectie hieronder komt op alle zestien doelidentiteiten overeen.

```bash
npm run fetch:ovsg-secundair -- --username-file /beveiligd/gebruiker --password-file /beveiligd/wachtwoord
```

Standaard ontstaat alleen een controlebestand in `data/corpus/ovsg-secundair/candidate.jsonl` met inventaris en voortgang. Voorkennis en expliciet lege opmaakslots worden als broncontext bewaard. Alle concrete centrale doelen, inclusief sluitstukken, worden afzonderlijk herkend. Alle aangeboden relaties moeten naar aanwezige bronentiteiten verwijzen. Een nieuwe onbekende slotvorm stopt de verwerking. `--offline` kan daarna de bronkopieën herverwerken zonder credentials of netwerk; `--publish` activeert uitsluitend na complete inventariscontrole de aparte dataset `OVSG_SECUNDAIR_2025`. Ze vervangt alleen de oudere OVSG-rijen in het lokale secundaire zoekcorpus, geen andere netwerken.

```bash
# Na de volledige inventariscontrole: apart lokaal activeren zonder netwerk
npm run fetch:ovsg-secundair -- --offline --publish
```

De actieve uitvoer is `data/secundair/leerplannen_ovsg_2025.jsonl`. De 4341 centrale records bestaan uit 2537 leerplandoelslots, 1151 basisoptiedoelslots en 653 minimumdoelsluitstukken. Het zijn broncontexten, geen telling van unieke onderwijskundige concepten over alle koepels. Alle oorspronkelijke HTML, concordanties, ondersteunings- en verdiepingsgegevens, voorkennis en uitbreidingen blijven bovendien in de broncatalogus bewaard. De 34156 gecontroleerde verwijzingen lossen allemaal op. Alleen externe mediabestanden worden niet afzonderlijk gekopieerd.

De dekking geldt voor deze vijf aangeboden **eerste-graadleerplannen**. Ze bewijst geen volledige secundaire dekking van alle graden of andere koepels; de gezamenlijke publieke secundaire PDF/Word-dataset heeft nog haar afzonderlijke brongrenzen.

De secundaire tool heeft op de selectiepagina de functie **Bewaar als Excel**. Ze verschijnt pas als er doelen geselecteerd zijn. Op 13 november 2026 is een echte selectie van zestien doelen via die functie geëxporteerd en met de importworker gecontroleerd. De export bevat de kolommen `doeltype`, `code`, `omschrijving`, `leerlijn`, `indeling` en `leerplan`.

```bash
npm run import:ovsg-export -- --input pad/naar/selectie.xlsx --output data/corpus/ovsg-exports/selectie.jsonl
```

Deze opdracht werkt uitsluitend op een lokaal bestand. Ze installeert niets, meldt niet aan en wijzigt de canonieke catalogus of appdata niet. De uitvoer is een controlebestand met een apart rapport. Bekende actieve datamappen worden als uitvoer geweigerd. Indien de selectiegrootte bekend is, kan `--expected-records AANTAL` ontbrekende of extra rijen detecteren.

Alle aangeboden kolommen en doeltypes blijven behouden. Dubbele codes binnen dezelfde broncontext, ontbrekende velden en formulecellen worden geweigerd. De worker heeft dezelfde proces- en ZIP-grenzen als andere bronparsers.

**Een selectie is geen volledig leerplan.** De app begrenst selecties op 500 doelen. De geteste Excel-export bevat de gekozen centrale doelen, maar niet alle ondersteunings-, verdiepings- en samenhanggegevens uit de webweergave. Het rapport vermeldt daarom altijd `complete_collection: false` en `published_to_app: false`. Er wordt geen volledige dekking verondersteld op basis van een geslaagde Excel-download.

### OVSG basisonderwijs

Op expliciete vraag is een afzonderlijke ingelogde verzamelaar gebouwd voor de gewone leesweergave van Leer Lokaal 2027-2028. Een exportknop is daarvoor niet vereist: de pagina bevat de getoonde doelen en hun relatiegegevens als een statische gegevensstructuur. De decoder leest uitsluitend toegestane letterlijke structuren met een AST-parser. Hij voert geen scripts van de website uit en heeft grenzen op geheugen, invoer, diepte, aantal bewerkingen en wandtijd.

```bash
# Bestanden met uitsluitend de gebruikersnaam respectievelijk het wachtwoord.
# Geef nooit de geheime waarden zelf als argument op.
npm run fetch:ovsg -- --username-file /beveiligd/gebruiker --password-file /beveiligd/wachtwoord

# Nieuwe handmatige broncontrole, ook als de hervattingscache nog jong is
npm run fetch:ovsg -- --username-file /beveiligd/gebruiker --password-file /beveiligd/wachtwoord --fresh

# Herverwerken zonder netwerk; herstelt ontbrekende cache uit het duurzame archief
npm run fetch:ovsg -- --offline
```

De aanvraagheaders bevatten de aanmelding; waarden komen niet in URL's, logs, bronmetadata of de repo. Alleen HTTPS op `leerlokaal.ovsg.be` en de aangeboden basisoverzicht-, leergebied- en leerlijnpaden zijn toegestaan. Redirects met inlogheaders en beheer-/redactieroutes worden geweigerd. Eén aanvraag tegelijk met willekeurige pauzes van 3 tot 7 seconden en iedere twintig aanvragen nog 12 tot 20 seconden extra. Geen wisselende identiteit, proxyrotatie of parallelle belasting. De grens is 220 aanvragen per run.

Herhalen hergebruikt gecontroleerde bronkopieën van maximaal 24 uur oud, zonder een nieuw broncontrolemoment te verzinnen. `--fresh` doet de echte broncontrole en `--offline` staat geen netwerk toe en heeft geen inloggegevens nodig. Ze mogen niet samen. De eigen werkcache staat standaard in `~/.cache/agent-werk/leerkrachtentools-corpus/ovsg-bao-2027/`. De catalogus bewaart ruwe entiteitvarianten en volledige grafen in `source_records` naast de verliesloos gecomprimeerde HTML-bronnen. Inventaris, voortgang en resultaat staan in `data/corpus/ovsg-bao-2027-2028/`.

De dataset heet `OVSG_BAO_2027_2028` en de appuitvoer `data/ovsg/ovsg_2027_2028_volledig.jsonl`. De app gebruikt die editie afzonderlijk met het schooljaar zichtbaar in de resultaten; ze voegt oudere OVSG-doelen niet toe. De oude bronbestanden blijven intact. Het account is niet aanvaard op het afzonderlijke updateportaal voor 2026-2027. De nieuwe verzameling bewijst dus geen dekking van die oudere editie of van het secundair onderwijs.

De gecontroleerde collectie van 13 november 2026 bevat 3937 centrale doelen. Daarvan hebben 3870 in de bron `is_goedgekeurd: true`. De overige 60 aanloopdoelen en 7 uitbreidingsdoelen hebben `false`; hun oorspronkelijke status blijft behouden en verschijnt in de toelichting van zoekresultaten. Ze worden niet van een verzonnen leeftijd voorzien. Ondersteuning en verdieping tellen apart van de centrale doelen. Een complete broninventaris betekent geen algemene verklaring dat elk aangeboden doel is goedgekeurd of nu van toepassing is.

### Overige toegang en downloadgrenzen

De publieke updater controleert robotsregels, vaste toegestane HTTPS-hosts en iedere redirect. Een aanvraag met een API-key mag geen redirect volgen. Op.stap gebruikt een API-pad dat momenteel geautomatiseerd ophalen uitsluit. Hiervoor blijft een toegestane actuele bulkexport nodig. OVSG's publieke robotsbeleid is ongewijzigd; de hierboven beschreven afzonderlijke accountworkflow leest op expliciete opdracht alleen de aangemelde basispagina's. POV ondersteunt de officiële Doelenverdeler-API met `POV_API_KEY` uit de lokale omgeving. Sleutels staan niet in URL's, rapporten of logs.

Een bron heeft maximaal 32 MiB per bestand, een run maximaal 512 MiB downloads en 5000 aanvragen. De eigen HTTP-cache is begrensd op 2 GiB. Tijdelijke fouten krijgen maximaal drie pogingen; een langere Retry-After stopt de bron. Een parser draait in een apart proces met een uitvoerlimiet, maximaal 45 seconden wandtijd en op Linux maximaal 768 MiB adresruimte en 30 CPU-seconden. ZIP-bestanden worden vóór verwerking begrensd. Dit is procesbegrenzing, geen OS-netwerksandbox.

De OS-lock sluit gelijktijdige updates uit. JSONL-vervanging gebeurt atomisch. Catalogustransacties en integriteitscontroles beschermen tegen halfgeschreven uitvoer; een onderbreking tussen bestand en database kan daarna via `corpus:export` worden hersteld. Dat controleert eerst de inhoudshash van de catalogus.

Er zijn geen productie-aanroepen, uploads naar Discovery Engine of publicaties onderdeel van deze updateopdrachten.
