# Reviewcorrectie PR #37 — effectieve startwaarde (5 oktober 2026)

Op head `81653020293d3ae1f4026082437151691a415e6c` is eerst een falende
end-to-endregressie toegevoegd: één reguliere Doel-paragraaf met directe numId,
niveau nul, decimal/LPD %1, abstracte start 5 en geen startOverride werd stil
als LPD 1 geëxporteerd. De test verwacht een expliciete weigering en faalde vóór de fix.

Bij eerste toepassing van een expliciete nummeringsinstantie geldt nu de concrete
startOverride indien aanwezig, anders de abstracte w:start. De effectieve waarde
moet overeenkomen met de ondersteunde doelvolgorde; afwijkingen worden geweigerd,
zonder een code te exporteren. De bestaande controle eenmaal per instantie,
documentlokale toestand en controle op voortzetting blijven behouden.

Ontbrekende w:start betekent volgens OOXML **0**, niet 1; die start wordt expliciet
geweigerd omdat de ondersteunde LPD-volgorde bij 1 begint. Een geldige override 1
heeft voorrang op basisstart 5 of een ontbrekende basisstart. Een aanwezige start
zonder w:val, niet-gehele waarde of dubbele startdefinitie wordt expliciet geweigerd;
een ongeldige override valt nooit stil terug op de abstracte start. Niveauvervangingen
en andere onbevestigde structuren blijven buiten de ondersteunde parsergrenzen.
De bestaande bronbewezen verwerking van stijlgebonden reguliere doelen blijft behouden.

Referentie: [OOXML start / StartNumberingValue](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.startnumberingvalue?view=openxml-3.0.1):
“If this element is omitted, then the starting value shall be zero (0).”
Een kopie van de geraadpleegde referentie blijft bij het private bewijs.

Validatie: **89 Python-tests** geslaagd, inclusief basisstart 1 met voortzetting,
basisstart 5 zonder override (weigering), basisstart 5 met override 1,
ontbrekende/ongeldige/dubbele metadata, override zonder start en alle eerdere
voortzettings-, conflict-, extra-doel- en exportcontextregressies.
Het echte KOV-document levert opnieuw 13 doelen: LPD 6 +, reguliere LPD 7–13,
minimumdoelkoppelingen en exportcontext behouden. De opnieuw afgeleide steekproef
blijft 369 GO! + 13 KOV = 382 records met exact dezelfde SHA-256
`bba39c3494a486c2b36852cf044362089be52dece9da5373c8cc55262f775d7d`.
Oorspronkelijke bron- en corpushashes zijn gecontroleerd en ongewijzigd.

Echte loader-/handler-/HTTPcontroles zijn herhaald zonder fixtures. Volledige npm ci
met scripts, Node 22.23.3, typegen, lint, typecheck, Node-tests, build, standalone,
lokale browsercontroles en actuele audit zijn geslaagd; logs staan bij het nieuwe bewijs.
De bestaande braces-mitigatie en vervaldatum blijven ongewijzigd. Definitieve head
en volledige GitHub-CI worden op de bijgewerkte draft-PR en in de oplevering vastgelegd.
Bewijsroot: `/workspace/corpus-validation-2026-10-04/followup/review-start-2026-10-05/`;
[observations.json](observations.json) bewaart de hashes. Geen bronnen/corpora gecommit.
Eerdere dataset- en rechtenblokkades hieronder blijven gelden. Geen merge, release of deployment.

---

# Reviewcorrectie PR #37 — expliciete lijstherstart

Review van head `268cabc59318efe4b421fe57b6dd33a6f1f8c2b6` bevestigde een regressie:
twee reguliere Doel-paragrafen met dezelfde directe numId en startOverride=1
veroorzaakten op de tweede paragraaf een ValueError in plaats van LPD 1 en LPD 2.
Dit is eerst als falende **end-to-endtest van parse_kov_docx** gereproduceerd.

De parser bewaart nu lokaal per document de volgende verwachte waarde per expliciete
nummeringsinstantie. De startOverride wordt bij eerste gebruik gecontroleerd;
volgende paragrafen moeten de geldige voortzetting volgen. Afzonderlijke instanties
worden zelfstandig gecontroleerd. Conflicterende herstarts, terugkeer naar een
onderbroken lijst, niet-decimale labels, afwijkende LPD-labels, niet-nulniveaus en
onbevestigde niveauvervangingen worden geweigerd. De bronbewezen behandeling van
stijlgebonden reguliere doelen en het aparte extra-doel blijft behouden.

**Validatie na correctie:**

- 80 Python-tests geslaagd, waaronder twee en drie opeenvolgende paragrafen met
  dezelfde instantie, afzonderlijke instanties met start 1/3, conflicterende herstart,
  documentisolatie, onbekende nummeringsstructuren en bestaande extra/exportregressies.
- Echt bewaard KOV-document opnieuw geparseerd: 13 doelen, LPD 1–5, LPD 6 +,
  LPD 7–13. Minimumdoelkoppelingen 7/8→02.13, 9→02.12, 10→02.10, 11→02.11,
  12→02.09, 13→02.08; onderwijscontext, domein, A-stroom en bronmetadata behouden.
- Gecorrigeerde steekproef opnieuw afgeleid: 369 GO! + 13 KOV = 382 records,
  SHA-256 `bba39c3494a486c2b36852cf044362089be52dece9da5373c8cc55262f775d7d`,
  exact gelijk aan eerdere gecorrigeerde steekproef; geen schemafouten.
- Originele bronnen en corpora behouden; corpuscontroles slagen voor originele
  3.490/381 records en afzonderlijk gecorrigeerde 3.490/382 records.
- Echte loader, 15 handlergevallen en 16 HTTPgevallen plus 401/403 geslaagd,
  zonder fixturemap: limieten 1–5, filters, bronlinks, extra-doel en LPD 13,
  context, ongeldige limieten en corrupte JSONL op een geïsoleerde kopie.
- Volledige npm ci met scripts, Node 22.23.3, typegen, lint, typecheck,
  765 Node-tests (één bestaande skip), build, standalone en lokale Chromium-controles
  geslaagd. Afzonderlijke testdatabase; analytics en telemetrie uit.
- Audit geslaagd: 960 packages, bestaande braces-finding tijdelijk gemitigeerd,
  nul overige blokkerende findings; uitzondering/vervaldatum ongewijzigd.

Reproduceerbaar aanvullend bewijs en scripts staan buiten Git onder
`/workspace/corpus-validation-2026-10-04/followup/review-restart/`.
[observations.json](observations.json) bevat de bewijs-hashes. De definitieve geteste
head en volledige GitHub-CI (inclusief Linux-isolatie en Chromium/Firefox/WebKit)
worden op de PR en in de oplevering vastgelegd; daarna geen repositorywijzigingen.
Ontbrekende datasets, GO_OUD-bronambiguïteit en vereiste hergebruikrechten blijven
zoals hieronder beschreven. Geen merge, release of deployment uitgevoerd.

---

# Vervolg na merge van PR #36 — 4 oktober 2026

Actuele main/begincommit: **`3b823bfef8f68e7d2de8899e459c7c2f37bef384`**, de daadwerkelijke
mergecommit van PR #36. Schoon begin; veilige switch/fetch/fast-forward, niets overschreven.
[Merge-CI 37208690760](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/37208690760)
is **GESLAAGD** op die exacte commit, inclusief Linux-isolatie, volledige browsermatrix en audit.
Geteste codecommit: **`6d2a2dd4e3c2a9c74abaf5763b0328fc67c11a9f`**.
Branch: `codex/curriculum-parser-followup-2026-10-04`. Definitieve rapport/headcommit en
nieuwe CI-uitkomst worden in de draft-PR en oplevering vastgelegd; rapportcommit wijzigt geen code.

De oorspronkelijke map `/workspace/corpus-validation-2026-10-04/` blijft behouden.
Raw, corpora en oud bewijs zijn niet vervangen. Nieuw bewijs, geïsoleerde probes en nieuwe
corpora staan onder `followup/`. De vorige rapportage is gelezen en blijft historisch bewijs.

## Main en behouden corpusdata

Node **22.23.3** volgens actuele CI; volledige `npm ci` met scripts uitgevoerd, zowel bij
start als na de fixes. Bestaande gecontroleerde testwrapper gebruikt; aparte synthetische
DB's, accounts en testsecrets, analytics/telemetrie uit. De cloudstatus rapporteert revision
**9**, dezelfde gekoppelde configuratieversie als eerder, unrestricted met handhavingsstatus
unknown; lokale policy unrestricted, geen VPN. Geen configuratie gewijzigd of bronhost
opnieuw gecrawld. Geen login, echte API-key, betaalde provider, externe upload of proxyomweg.

| Behouden corpus | Aantal | SHA-256 | Vergelijking |
| --- | --- | --- | --- |
| GO_NIEUW | 3.490 | `fa481496da9747eedb8c6e3cc310d02da3fdf7696921f94a6a18fa58051fcb0e` | Exact gelijk |
| SECUNDAIR_LEERPLANNEN | 381 | `0e52ebb443a29cc6e4ac88b971c61a43573174dcd609ba6205855ee23cfd1c37` | Exact gelijk; uitsluitend steekproef |

Ook de hashes van de drie onderzochte bronbestanden GO_OUD-PDF, secundair GO!-PDF en
KOV-Word zijn exact gelijk aan het eerdere bewijs. [observations.json](observations.json)
bewaart die vergelijking en hashes van het nieuwe private bewijs.

`check:corpora --required GO_NIEUW,SECUNDAIR_LEERPLANNEN` is opnieuw **GESLAAGD**.
De totale controle is opnieuw **MISLUKT** omdat twaalf datasets ontbreken. Die ontbrekende
bestanden zijn niet opgevuld met fixtures. Main's echte loader, vijftien handlercontroles en
tien HTTPzoekaanvragen zijn herhaald op een afzonderlijke kopie van de behouden data,
zonder fixturemap. Limieten 1–5, bronlinks, onderwijsniveaus/netwerken, 400-validatie,
401 zonder sessie, 403 bij ongeldige origin en corrupte JSONL zijn gecontroleerd.
Geen fouttest schrijft naar het oorspronkelijke corpus; mutaties gebeuren op een testkopie.

## GO_OUD: bronambiguïteit verhindert een betrouwbare volledige omzetting

De beschikbare bron is Nederlands 2013/1, inspectienummer 2013/885/1, 114 PDFpagina's.
Alle pagina's zijn onderzocht met layouttekst. Zeventig pagina's bevatten doeltabellen;
er zijn **472 rijen met een volledige nummerprefix** en nog één rij met alleen **22**.
De zeven prefixgroepen bevatten verder doorlopende nummerreeksen zonder overlap.

PDFpagina 81 (gedrukte pagina 80) toont de doelen 1.2.3.21 en 1.2.3.23. De tussenliggende
rij over schrijfhouding vermeldt in de CODE-cel uitsluitend **22**, zonder prefix.
Dit is ook visueel bevestigd met een lokaal gerenderde pagina, opgeslagen buiten Git.
Het ontbrekende gedeelte is dus geen aanname op basis van mislukte tekstretrieval.

De tabellen hebben bovendien afzonderlijke KO/LO-kolommen, jongste/oudste kleuters en zes
leerjaren, met verschillende betekenissen voor `X`, `x` en `+`. De toelichting vermeldt
respectievelijk bereiken, aanzetten en verder meenemen; afwezigheid betekent niet eenvoudig
"niet van toepassing". OD/ET-verwijzingen en meerregelige doelinhoud staan in eigen kolommen.
Een generieke tekstregex zou die context verliezen of extra rijen verkeerd koppelen.

**GEBLOKKEERD voor publicatie als volledig GO_OUD-corpus.** Geen prefix toegevoegd,
geen fictieve doelcode en geen volledige dekking aangenomen. Er is geen nieuwe GO_OUD-parser
of GO_OUD-JSONL gepubliceerd. De bruikbare layout/rij-inventaris en het visuele bewijs blijven
beschikbaar voor een vervolg zodra bronidentiteit en gestructureerde context bevestigd zijn.

## KOV: bevestigde fouten en bronbewijs

Hetzelfde document I-Ned-a oktober 24–november 25 bevat twaalf `Doel`-paragrafen en één
`Doel: Extra`. Onderliggende Wordnummering:

- `Doel`: numId 40, abstractNum 24, label `LPD %1`.
- `Doel: Extra`: numId 38, abstractNum 30, start **6**, label **`LPD %1 +`**.
- Het eerstvolgende reguliere doel heeft direct numId 27, abstractNum 24 en expliciete
  startOverride **7**. Bronverwijzingen naar LPD 7–13 ondersteunen die volgorde.

Het extra doel staat in **Communicatie en informatie**, graad 1, A-stroom. Er is voor dit
extra doel geen expliciete MD/SMD-koppeling aangetroffen. Het krijgt geen koppeling van een
regulier doel met hetzelfde getal. De latere reguliere doelen behouden de echte
MD-verwijzingen: LPD 7/8 → 02.13, 9 → 02.12, 10 → 02.10, 11 → 02.11,
12 → 02.09 en 13 → 02.08. UD/BG-verwijzingen blijven onderscheiden van MD/SMD;
er zijn geen nieuwe minimumdoelteksten of vermeende aanvullende koppelingen verzonnen.

| Bevestigde fout | Reproduceerbaar vóór fix | Verbetering |
| --- | --- | --- |
| Extra doel ontbreekt; latere codes schuiven | Echte parser levert 12 records en noemt het eerste literaire doel LPD 6 in plaats van 7 | Extra wordt `I-Ned-a LPD 6 +`; volgende reguliere doelen blijven 7–13 |
| MD-code met interne spatie verkeerd gelezen | Bron heeft `MD 02. 08`; huidige regex leest gedeeltelijk `02.` | Alleen syntactische spatie bij de punt verwijderd: daadwerkelijke code 02.08, gekoppeld aan LPD 13 |
| Export verliest context/minimumkoppelingen | `normalize_curriculum_record` verwijdert subdomein, bronlabel en minimumdoel_codes | Deze bestaande metadata blijft als aanvullende velden behouden naast het verplichte schema |

Vier gerichte synthetische regressies falen op actuele main en slagen na de fix. Zij toetsen
extra-doelnummering/latere koppelingen, ontbrekend bronbewijs, exportbehoud en conflicterende
expliciete herstart. De nieuwe extra-parser accepteert alleen de aangetoonde niveau-nul,
decimale LPD-plusstructuur met een passende bronstart. Andere extra-nummering en expliciete
herstarts die niet overeenkomen worden geweigerd, niet geraden. Dit is geen algemene Word-
nummeringsrenderer en geen bewijs voor alle KOV-templatevarianten.

De JSONL-export bewaart nu ook bestaande stroom, route, bronlabel, subdomein,
sleutelcompetentiemetadata, minimumdoel_codes en het expliciete extra-doeltype waar aanwezig.
De verplichte velden blijven gelijk. Auth, quotas, redirectbeveiliging, parserisolatie,
audituitzondering en vervaldatum zijn niet gewijzigd.

## Afzonderlijk opnieuw afgeleid corpus en appcontroles

De echte scraperfuncties parse_pdf/parse_kov_docx, deduplicatie en `_write` zijn opnieuw
uitgevoerd op de bewaarde documenten. Nieuwe output staat uitsluitend in
`/workspace/corpus-validation-2026-10-04/followup/revised/corpora/`.

GO!-deel: **369** doelen. KOV-deel: **13**, waaronder het extra doel. Totaal: **382**, nog
steeds uitsluitend twee documenten/een steekproef. De stijging van 381 naar 382 is verklaard
uit de bron; aantallen zijn niet geforceerd. De hash verandert ook door correcte codes,
koppelingen en behoud van aanvullende context/bronmetadata:
`bba39c3494a486c2b36852cf044362089be52dece9da5373c8cc55262f775d7d`.
GO_NIEUW is in de nieuwe map een exacte kopie met dezelfde 3.490 records en hash.

| Controle | Uitkomst |
| --- | --- |
| Merge-CI op 3b823bf | **GESLAAGD**, volledige quality-job |
| Pythonregressies en AST | **GESLAAGD**: 72 tests, 46 bestanden |
| Volledige npm ci, Next typegen, lint, typecheck | **GESLAAGD** |
| Node-tests | **GESLAAGD**: 155 bestanden, 765 tests, 1 bestaande echte-corpus-skip |
| Productiebuild, standalone, Chromium client/preview/privacy en standalone-browser | **GESLAAGD** |
| Alle 14 corpora, oorspronkelijke en gecorrigeerde datamap | **MISLUKT**: twaalf ontbrekende datasets |
| Beide beschikbare corpora afzonderlijk, oorspronkelijke en gecorrigeerde datamap | **GESLAAGD**; 3.490/381 en daarna 3.490/382 |
| Echte loaders en vijftien handlercontroles zonder fixtures | **GESLAAGD** voor behouden en opnieuw afgeleide data; verkeerde niveaus, fouten en providerloze terugval gecontroleerd |
| Echte HTTPzoekroutes, gecorrigeerde data | **GESLAAGD**: 16 gelogde aanvragen plus 401/403; limieten 1–5, netwerk/niveau/graadcontext, bronlinks en exacte LPD 6 + en LPD 13 |
| Dependency-audit, bij begin en na fixes | **GESLAAGD MET TIJDELIJKE MITIGATIE**: 960 packages, 1 braces-finding, 1 gemitigeerd, 0 overige blokkerende findings |
| Linux-isolatie en volledige browsermatrix lokaal | **GEBLOKKEERD / NIET HERHAALD** op deze cloudhost; merge-CI heeft ze bewezen; nieuwe draft-CI wordt afzonderlijk gecontroleerd |
| Betaalde AI, echte API-keys, Discovery Engine | **NIET ONDERZOCHT**, volgens opdracht uit |
| GO_OUD volledige omzetting | **GEBLOKKEERD** door bronambiguïteit; geen dataset gepubliceerd |

De audit gebruikt de normale proxy/CA/TLS via de bestaande externe Undici-preload.
Braces@3.0.3 / GHSA-vfj7-8cjw-p6xm blijft aanwezig met lokale backport, geen officiële
herstelrelease. Vervaldatum onveranderd **17 oktober 2026 om 00:00 UTC** (02:00 Brussel).
Groene audit betekent geen afwezige kwetsbaarheid. Geen operationele DigitalOceanacceptatie.

## Reproduceren en exacte resterende gegevens/toestemmingen

Bewijsroot: `/workspace/corpus-validation-2026-10-04/followup/`. Onder `evidence/` staan
vóór/na-tests, Wordnummeringsstructuur, GO_OUD-paginering/rij-inventaris en projectlogs.
`merged/evidence/` en `revised/evidence/` bewaren echte loader-/handler-/HTTPresultaten.
`regenerate.py`, `checks.sh` en de geïsoleerde probes zijn daar beschikbaar zonder oude logs
te overschrijven. Alleen rapport en hashes worden gecommit; geen bronnen, corpora of renders.

```sh
/workspace/corpus-validation-2026-10-04/venv/bin/python -m unittest discover -s scripts/tests -v
/workspace/corpus-validation-2026-10-04/venv/bin/python /workspace/corpus-validation-2026-10-04/followup/regenerate.py
bash /workspace/corpus-validation-2026-10-04/run-test-env.sh npm run check:corpora -- --data-root /workspace/corpus-validation-2026-10-04/followup/revised/corpora --required GO_NIEUW,SECUNDAIR_LEERPLANNEN
bash /workspace/corpus-validation-2026-10-04/run-test-env.sh node /workspace/corpus-validation-2026-10-04/followup/revised/http-probe.mjs
```

Nog regelen:

1. GO!: bevestiging van de volledige identiteit van rij **22** op gedrukte pagina 80 van
   Nederlands 2013/1, of een officiële gestructureerde export met doelcodes, KO/LO-context,
   X/x/+-markeringen en OD/ET-relaties. Daarna pas volledige omzetting/inhoudelijke acceptatie.
2. Expliciete commerciële hergebruikrechten of passende gelicentieerde exports voor de
   betrokken koepelbronnen; publieke bereikbaarheid en dit parseronderzoek bewijzen die niet.
3. Toegestane bulkexports voor Op.stap, ZILL en OVSG en geautoriseerde onderwijsdoelen-/POV-
   exports zonder hier echte keys te gebruiken. Twaalf datasets blijven ontbreken.
4. Volledige secundaire dekking voor de aangeboden graden/finaliteiten/netwerken en bronbewijs
   voor andere KOV-nummeringsvarianten. De nieuwe 382-recordset is geen volledig corpus.
5. Definitieve GO!-bronversies/goedkeuringsstatus, operationele DigitalOceanacceptatie en een
   structurele oplossing voor braces vóór de ongewijzigde vervaldatum.

Geen merge, release of deployment uitgevoerd.
