# Eindcontrole D1-01 en D1-02, 9 september 2026

Dit is de onafhankelijke sluitingscontrole van D1-01 en D1-02. Het is geen toestemming om te pushen, mergen, migreren of deployen. Het oordeel betreft de ontvangen bestanden, niet een cryptografisch bewezen volledige Git-commit.

## Besluit

D1-01 en D1-02 zijn in de aangeleverde code onafhankelijk bevestigd als hersteld. Voor deze twee tickets is geen nieuwe codeherstelopdracht nodig.

De oorspronkelijke PR1-01 t/m PR1-04, listenercleanup A, de veilige AI-overlapdefault B en alle vijf oorspronkelijke CONTROL-tests blijven groen. Binnen deze gerichte hercontrole is geen nieuw blokkerend probleem gevonden.

Dit sluit niet de volledige securityaudit of productievoorbereiding af. V20-08 / PR1-05 en H-01 t/m H-06 blijven open. Deze review voert geen merge, productiemigratie of deployment uit.

## Onderzochte levering

- Bestand: `pr1-d1-complete-files.zip`
- SHA-256: `97c6fdf91cd90ae80ec7eb671d54070d635f4379b714769aa0f190f6601df407`
- Volgens het meegeleverde manifest: head `d561302f44a090efda8db695dd954daf39263b50`, vorige versie `d1bd137ef96f70eaabc2909a192f57793956e58d`, base `a62c5c91e5c29665c6ed78e44d27810771e9e29a`
- Zes bestanden in de ZIP: API-guard, quotatests, meegeleverde D1-tests, twee documentatiebestanden en SHA/resultaatmetadata
- Getest in een nieuwe lokale kopie van de vorige gecontroleerde samengestelde bronversie, met de nieuwe bestanden daaroverheen. Er zijn geen fixes in de applicatiecode aangebracht.
- Alle zes aangeleverde bestanden komen tekstueel overeen met de geteste bestanden, afgezien van normalisatie van regeleindes/eindwitruimte.
- De ZIP bewijst niet cryptografisch de volledige Git-commit of dat de volledige branch geen andere wijzigingen bevat. Het oordeel betreft de ontvangen code. De volledige GitHub-PR en CI op de uiteindelijke te mergen revisie zijn niet in deze ronde geverifieerd.
- Windows / Node 24.19.0, eerder geïnstalleerde ongewijzigde dependencies. De basis-testkopie heeft projectversie 5.20.0; de dependencyversies en applicatiebasis zijn dezelfde als de eerder gecontroleerde 5.20.1-basis. Geen dependency-upgrade uitgevoerd.

## D1-01: usage-logging, bevestigd hersteld

In `lib/api-guard.ts` is de loggingbeslissing gescheiden van quota-afronding (`logExecutedWork` versus `completeInFinally`).

Onafhankelijk bewezen:

1. Normale 200 zonder Idempotency-Key: één usage-log, één verbruikseenheid.
2. Eerste idempotente 200 plus replay: één uitvoering, één usage-log, één verbruikseenheid.
3. Falende logwriter: de spy wordt daadwerkelijk eenmaal aangeroepen; response, cache en verbruik blijven intact; replay probeert de writer niet opnieuw voor dezelfde uitvoering.
4. Expliciete 422-response: één log met status 422; identieke replay.
5. Gewone handlerfout: één log met publieke status 500.
6. Echte timeout met late afronding: één log met publieke status 429, geen extra log of consume bij late completion of replay.

De eerdere regressie (geen usage-log bij succesvol werk) kan dicht. De denial-samplingcontrole blijft groen; logging is niet weer onbegrensd per 429 gemaakt.

## D1-02: fout versus timeout, bevestigd hersteld

De guard maakt onderscheid tussen een gewone rejection en een timer die daadwerkelijk afgaat (`timedOut` alleen via de deadline-timer).

Onafhankelijk bewezen:

- Onmiddellijke gewone Error: eerste antwoord 500, replay 500, identieke body.
- Interne fouttekst wordt niet aan de client doorgegeven.
- Expliciete 422 blijft 422; wordt niet als timeout of generieke 500 behandeld.
- Werkelijk verlopen deadline blijft 429, ook bij replay vóór en na late completion.
- Zowel late success als late rejection: geen cache-overschrijving, geen tweede uitvoering of consume.
- De lease wordt bij afgerond werk vrijgegeven; bij een timeout met nog lopend werk blijft ze in het geteste venster actief.

Het eerdere probleem (eerste 500, retry 429) kan dicht.

## V20-08: deellease bevestigd, restwerk blijft open

De oorspronkelijke karakterisatietest verwachtte dat een stream-timeout de lease te vroeg vrijgaf. Op de D1-code faalde die oude verwachting doordat de lease nu wel actief bleef tot de body is uitgelezen. Dat is een verbetering, geen regressie.

Bevestigd in het geteste venster:

- Direct na de publieke 429: één actieve lease.
- Na het werkelijk uitlezen van de body: nul actieve leases.
- De producer kan na de publieke 429 nog data leveren.

Dit is geen worker-kill of volledige cancellationketen. De huidige routes verbinden het signaal niet volledig door naar alle onderliggende verwerking. Lease-expiry stopt werk niet. Een actief blijvende lease tot bodyafronding bewijst niet dat eindeloos of CPU-gebonden werk hard wordt beëindigd.

Zie `docs/audit-v20-followup.md` voor de gesplitste ticketbeschrijving. H-01 t/m H-06 blijven open.

## Testresultaten van de onafhankelijke reviewer

| Controle | Eigen resultaat |
|---|---|
| Oorspronkelijke 20 reviewtests, na bijwerken van de verbeterde streamverwachting | 20 geslaagd |
| Vijf extra acceptatietests | 5 geslaagd |
| Zes tests uit de aangeleverde ZIP | 6 geslaagd |
| Totaal gerichte eindrun | 31 geslaagd, 0 gefaald |
| Reguliere suite incl. meegeleverde D1-tests | 111 bestanden: 498 geslaagd, 1 skipped, 1 todo, 0 gefaald |
| Route-typegeneratie | Geslaagd |
| TypeScript | Geslaagd |
| ESLint voor gewijzigde guard/quotatests/meegeleverde reviewtests | Geslaagd |
| Productiebuild / GitHub-CI | Niet onafhankelijk opnieuw uitgevoerd |

De 31 gerichte tests zijn 25 eigen tests en 6 meegeleverde tests; een deel dekt dezelfde situaties.

Grenzen van die reguliere suite: `corpus-hygiene` uitgesloten omdat die `git ls-files` vereist; één skipped testcase door ontbrekende secundaire corpusdata; één todo betrof V20-08; timeout 30 seconden; maximaal twee fork-workers. Daarom wordt Cursors "500 passed" niet als exact eigen lokaal resultaat overgenomen. Geen live provider-, proxy-, productie- of databaseaanval. Eigen tests gebruiken synthetische data in SQLite `:memory:`.

## Vervolg

1. Markeer D1-01 en D1-02 als hersteld voor deze gecontroleerde code. Laat de eerder bevestigde fixes intact.
2. Controleer vóór een latere merge dat de volledige PR tegen de juiste actuele GitHub-main dezelfde bedoelde wijzigingen bevat en dat CI op die exacte revisie groen is. Een bestands-ZIP vervangt die branchcontrole niet.
3. Houd V20-08 en H-01 t/m H-06 zichtbaar open; bepaal hun prioriteit en aanvaardbaarheid voor de beoogde productie-inzet apart.
4. Productiemigratie en deployment blijven aparte goedkeuringsstappen met geteste backup/herstel en gecontroleerde cutover. Reconciliatievariabelen niet als standaard instellen. Migratiemarker niet verwijderen.

Geen nieuwe herstelronde voor D1-01/D1-02 nodig op basis van deze tests. Dit document is een gerichte sluitingscontrole, geen verklaring dat de hele applicatie of productieomgeving vrij van kwetsbaarheden is.

Reproductie in een aparte testkopie, nooit met een productie-`DATABASE_PATH`:

```sh
npx vitest run review-evidence --pool=forks --maxWorkers=1 --testTimeout=30000
```
