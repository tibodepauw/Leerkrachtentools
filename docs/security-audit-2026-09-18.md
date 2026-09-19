# Securityaudit vóór de eerste productie-installatie

> Statusupdate 19 september 2026: de opeenvolgende herstelrondes zijn gemerged en opgenomen in [v5.21.0-rc.1](releases/v5.21.0-rc.1.md). Onderstaande resultaten, branchstatus en vervolgpunten zijn een historische momentopname, geen actuele openstaande-takenlijst. Zie de [documentatie-index](README.md) en [installatiehandleiding](digitalocean-first-deployment.md) voor de huidige baseline en resterende productieacceptatie.

Datum: 18 september 2026. Baseline: `main` op `3a23381158ec724b580fbf9d703f0da571fec51f`, inclusief PR #3. Herstelbranch: `codex/security-audit`. Er is geen deployment uitgevoerd. Alle actieve proeven gebruikten synthetische gegevens op Windows en de Linux-CI-runner; er zijn geen echte e-mails verstuurd of AI-providerverzoeken gedaan.

## Oordeel

Vervolg na merge van deze audit: [aanvullende privacy- en kostencontrole](privacy-cost-review-2026-09-18.md), met nieuwe regressies voor quota na fallback en late documentresultaten. De historische resultaten hieronder blijven aan hun genoemde commits gekoppeld.

De repository bevatte drie reproduceerbare applicatieproblemen: beïnvloeding van de appopmaak vanuit een Word-preview, een vastlopende ODT-tekstbewerking en databankgroei door reeds geweigerde OTP-pogingen. Deze zijn op de herstelbranch opgelost. Daarnaast is een kwetsbare builddependency bijgewerkt en zijn uploadcapaciteit, afbreking van AI-verzoeken en de dependencycontrole aangescherpt.

Alle in deze audit bevestigde repositorybevindingen zijn op de herstelbranch aangepakt. De volledige Linux-CI van de laatste codewijzigingen op commit `fa768c4236d49223652782cc0c9526e08b8df36b` is [geslaagd](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/35383458537): 568 tests, kernelisolatie, uitgebreide HTTP-/browserproeven en hersteltest. De branch is nog niet gemerged. Review en de hieronder beschreven controles van de echte VM, providers en offsite-backups blijven nodig. Een codeaudit bewijst niet de afwezigheid van alle onbekende fouten en is geen vrijgave van een nog niet bestaande productieomgeving.

## Bevindingen en herstel

| ID | Ernst in deze toepassing | Bevinding | Herstel en bewijs |
| --- | --- | --- | --- |
| SEC-01 | Middel | `docx-preview` monteerde stijlen uit een geüpload Word-document in de app-DOM. Een synthetische DOCX kon een CSS-eigenschap van de omringende `body` veranderen, ook met de bestaande CSP. Dit kan de appweergave manipuleren; uitvoering van JavaScript of accountovername is hiermee niet aangetoond. | Word wordt in een apart iframe gerenderd, met sandbox zonder scripts/formulieren/popups/topnavigatie en een strenge eigen CSP. Navigatie via documentlinks wordt geblokkeerd. Browsertest bewijst dat dezelfde CSS alleen nog het documentframe raakt en dat scripts, externe bronnen en links worden tegengehouden. PDF-blobs krijgen expliciet het PDF-MIME-type. |
| SEC-02 | Hoog voor beschikbaarheid | De ODT-regex `<[^>]+>` scant bij herhaalde ongesloten `<`-tekens steeds de resterende tekst. Een ongecomprimeerd archief met 300.000 van die tekens passeerde de uploadlimieten maar blokkeerde de verwerking. | De oorspronkelijke extractie is uitsluitend in een childproces getest en na drie seconden hard gestopt. Tagpatronen sluiten nu ook `<` binnen een match uit. De regressietest verwerkt dezelfde payload binnen de gestelde 1,5 seconde. Geen destructieve belastingstest op een live server uitgevoerd. |
| SEC-03 | Middel | OTP-verificatie boekte eerst de e-mailbucket en weigerde daarna op IP/global. Een reeds geblokkeerde afzender kon met nieuwe e-mailwaarden databaserijen blijven toevoegen. | Alle buckets vallen nu onder één SQLite-transactie. Voor herstel voegden 50 geweigerde pogingen 50 rijen toe; de nieuwe test eist nul extra rijen en slaagt. |
| SEC-04 | Builddependency; advisory: hoog | `js-yaml` 4.3.1 bevat de CPU-uitputtingskwetsbaarheid GHSA-2883-xcg3-v3hh. In deze lockfile is dit een ontwikkeldependency; er is geen productie-YAML-uploadpad vastgesteld. | Alleen de compatibele transitive dependency bijgewerkt naar 4.3.2. De lockfile wijzigt één package. OSV controleert vervolgens 968 productie- en buildpackages zonder bekende meldingen. |
| SEC-05 | Laag, controlebetrouwbaarheid | De bestaande OSV-gate behandelde een ontbrekende `results`-lijst als een lege lijst kwetsbaarheden. | Onvolledige aantallen, foutresultaten en misvormde records laten de controle nu falen. Tests voor ontbrekende/ongeldige antwoorden en normale resultaten toegevoegd. CI scant voortaan ook builddependencies. |
| SEC-06 | Middel, begrenzing van middelen | Documentcapaciteit werd pas gecontroleerd nadat de volledige upload was gebufferd. Avataruploads hadden geen eigen gelijktijdigheidsgrens. | Eén upload tegelijk per gebruiker en vier voor de gehele app-instance, gedeeld over document- en avataruploads. Het slot wordt vóór het inlezen genomen en bij succes/fout vrijgegeven. Regressietest bevestigt dat geweigerde taken niet beginnen met inlezen. Er is geen OOM geforceerd om dit risico te demonstreren. |
| SEC-07 | Laag, kosten en middelen | De algemene analysehandler, handleidingscanner, dialoogformatter en audioreflectie gaven clientafbreking niet door aan de AI-router. | `request.signal` wordt doorgegeven. Een routetest bevestigt dat afbreking de provider bereikt; bestaande routertests controleren dat daarna geen fallbackprovider start. Dit bewijst niet dat een externe provider reeds aangenomen werk niet factureert. |

De fout in één bestaande quota-test is ook hersteld: de test telde alle `api_usage_logs`, inclusief logs van parallelle tests. De meting filtert nu op de eigen sleutel. Dit was een testisolatieprobleem, geen aangetoonde omzeiling van het productiequota.

## Aanvullende herstelronde op verzoek van de eigenaar

De eigenaar vroeg door te werken aan alle resterende repositoryproblemen en bevestigde dat er nog geen VM is. Daarom is nu ook de procesgrens geïmplementeerd:

- Alle documentimport (ook DOCX/ODT/RTF), bron-Word-export en avatardecodering gebeuren buiten het hoofdproces. Productie gebruikt een private Unix-socket met maximaal twee afzonderlijke systemd-services. Iedere job heeft een lege rootomgeving met alleen runtimebibliotheken, dependencies, workerbestanden en optionele formuliertemplates; appdata, databases, secrets en thuisdirectories zijn niet gemount. DynamicUser, een privé-netwerk, AF_UNIX-beperking en een read-only bestandssysteem beperken de toegang. Per job: 512 MiB inclusief native geheugen, 32 taken, 10 seconden looptijd; de gezamenlijke slice begrenst geheugen op 1 GiB. Lokale Windows-tests gebruiken expliciet een childproces en bewijzen deze Linux-grens niet.
- Alle drie productie-B2B-routes voeren berekeningen uit in een apart proces. Timeout, disconnect en verlies van een lease leiden tot SIGKILL; slots worden pas na de close-bevestiging vrijgegeven. Een deadline kan niet boven 45 seconden worden geconfigureerd. Een te late heartbeat kan een verlopen lease niet heropenen. Maximaal vier B2B-processen per app-instance. Deze processen voeren vertrouwde applicatiecode uit en krijgen de benodigde providerconfiguratie; ze zijn geen sandbox voor externe code.
- De Pro-organisatietak bleek nog geen apart AI-dagbudget af te boeken. De eerdere documentatie claimde dit ten onrechte. Nu boekt een SQLite-transactie maximaal 100 analyses per organisatie en 500 over alle organisaties per UTC-dag (configureerbaar, nul schakelt uit). Dit staat los van het maandelijkse API-quota; providerfouten en procesafbreking geven gereserveerd budget niet terug. Bij uitputting volgt de bestaande snelle fallback.
- Een avatarjob controleert de sessie opnieuw vóór opslag. Een nieuwe, unieke bestandsversie en de databaseverwijzing worden zonder tussentijdse await opgeslagen; bij een mislukte database-update wordt het nieuwe bestand verwijderd. Zo schrijft een late job na accountverwijdering geen nieuwe avatar weg.
- Publieke productie vereist HTTPS, een zuivere APP_ORIGIN en de documentserviceconfiguratie. De ontwikkeloptie voor lokale parsers wordt geweigerd voor publieke origins. De standalone-build neemt ook dynamisch geladen workerdependencies en native bibliotheken mee.

Nieuwe bewijzen: processJob.test.ts stopt echte eindeloze CPU-lussen en controleert dat hun PID verdwenen is; workerLease.test.ts test deadline, disconnect, leaseverlies en niet-herleven; parserWorker.test.ts controleert weigering zonder service; orgBudget.test.ts controleert organisatie- en globale daggrenzen. De HTTP-smoke test gebruikt de echte build voor B2B, DOCX-export/herimport en avatars. De Linux-acceptatie slaagt met dezelfde systemd-beveiligingsinstellingen: hostbestanden en schrijven geweigerd, netwerk door de kernel geweigerd, CPU-lus beëindigd met `timeout`, native geheugengroei met `oom-kill`, gevolgd door de echte PDF-/DOCX-/avatarflows. De CI-proef ontdekte ook dat de PDF-library `os.homedir()` nodig heeft: `HOME=/tmp` verwijst nu naar het private, begrensde tmpfs. Hiervoor zijn geen host-thuismap of ruimere netwerk-/systeemrechten toegekend. **Er is geen DigitalOcean-VM getest.**

De koude hersteltest gebruikt de echte SQLite-backuphelper, kopieert de snapshot naar een andere database en start een tweede standalone-app. Die accepteert de herstelde sessie, ontsleutelt de synthetische providercredential met dezelfde encryptionsecret, weigert de ingetrokken B2B-sleutel en behoudt maandquota, AI-dagbudget en avatarbytes. Deze proef slaagt lokaal en op Linux; offsite-overdracht, versleutelde backupopslag en een lege tweede host vallen buiten deze repositoryproef.

## Onderzochte onderdelen

**Dit is een overzicht van reeds uitgevoerde controles, geen lijst met nog onbehandelde problemen.** De laatste kolom beschrijft de bewijslimiet: bijvoorbeeld een niet-bestaande VM, echte provideraccounts of de onmogelijkheid om alle toekomstige invoer te testen. Een bewijslimiet betekent niet automatisch dat er een kwetsbaarheid is. Nieuwe reproduceerbare codeproblemen worden hieronder afzonderlijk geregistreerd en hersteld.

| Onderdeel | Reeds uitgevoerd: controle en resultaat | Wat hiermee niet volledig is bewezen |
| --- | --- | --- |
| Login en sessies | OTP-hashing, pogingslimiet, willekeurige sessietokens, server-side intrekking, cookieopties, productie/dev-scheiding en e-mailtoegangslijsten doorgenomen. De productie-HTTP-proef weigert ontbrekende sessies en ongeldige B2B-sleutels. | Echte Brevo-bezorging en publiek misbruikvolume niet getest. Het globale OTP-noodplafond kan bij een verdeelde aanval legitieme aanmeldingen blokkeren. |
| Autorisatie en CSRF | Centrale guard, moduletoegang en accountgebonden queries doorgenomen. HTTP-proeven op 25 beschermde API-paden weigeren ongeauthenticeerde aanvragen, cross-origin mutaties en vervalste middlewareheaders; accountverwijdering zonder Origin wordt geweigerd. B2B met ongeldig Bearer-token krijgt 401. | Dit is een gerichte matrix, geen bewijs voor iedere mogelijke HTTP-normalisatie of elk toekomstig endpoint. |
| B2B, quota en replay | Scope, verval/intrekking, rotatie, organisatiebudget, gebonden idempotency-digests, gelijktijdigheid, leases en begrensde logs bekeken. Bestaande regressies lopen mee. | De productie-routes zijn nu naar afbreekbare processen verplaatst; externe providers kunnen reeds aangenomen werk alsnog factureren. De generieke guard is geen sandbox voor toekomstige callbacks. |
| Uploads en uitvoer | Bestandsgrootte/signatures, werkelijke ZIP-inflatie, paden, parserprocessen, avatardecodering, preview-DOM en React-uitvoer bekeken. Synthetische geldige/ongeldige PDF en ODT en kwaadaardige Word-opmaak getest. | Geen volledige fuzzcampagne; niet iedere echte DOC/DOCX/PDF-variant getest. PDF-weergave vertrouwt op de browserviewer. |
| Geheimen en database | Parameterbinding in onderzochte queries, sessiehashes, AES-GCM-contextbinding voor providerkeys, gerichte accountqueries en gegevensverwijdering bekeken. Patroonscan van 2.011 unieke tekstblobs uit lokaal opgehaalde Git-refs: één match, een bewust ongeldige testfixture met `abc` als private key; geen echte sleutel in die scan bevestigd. | De scan herkent geselecteerde sleutelpatronen, geen willekeurig geheim of verwijderde/onbereikbare remote objecten. VM-secrets en dashboards zijn niet ingezien. |
| AI en externe verzoeken | Providerhosts zijn code/configuratiegebonden; gebruikers geven geen vrije fetch-URL aan de upload-SDK door. Base64 wordt naar begrensde bytes omgezet. Gestructureerde uitvoer wordt gevalideerd, er zijn geen modeltools voor systeemacties in de onderzochte router. | Promptinjectie kan de inhoud van een analyse beïnvloeden. Modeluitvoer blijft advies; er is geen garantie op inhoudelijke juistheid. |
| Browserprivacy | Tests voor gedeelde opslag, sessiemeldingen en werkelijke browseracceptatie zijn toegevoegd. Serviceworker cachet geen API-antwoorden of accountpagina's; analytics replay staat uit. | Geen Safari/Firefox-acceptatie, echte browsercrash/heropenen of juridische privacybeoordeling. Normale apparaatmodus bewaart lessen lokaal volgens de bestaande productkeuze. |
| Supply chain en GitHub | Next.js 16.3.3 is de gepatchte augustusversie. Actions zijn op SHA gepind, tokenrechten zijn beperkt en credentials worden niet in de checkout bewaard. GitHub bevestigt `main` beschermd met verplichte `quality` voor iedereen; baseline-main-CI en auditbranch-CI zijn groen. | Dependabot-majorupdates zijn niet automatisch gemerged. Review/merge en release-tagbeleid blijven aparte stappen. |
| VM en backups | Nginx/systemd-templates, forwardingvertrouwen, bindadres en limieten doorgenomen. Linux-parserisolatie en een koude SQLite-/app-/avatarhersteltest slagen in CI. | De echte firewall, HTTPS, offsite-backupopslag en herstel op een lege tweede host zijn nog niet getest. Die infrastructuur is nog niet beschikbaar. |

## Validatie van de eerste herstelronde

De tweede herstelronde slaagt lokaal en in Linux-CI met **534 tests in 121 bestanden**, nul fouten, geen TODOs en één bestaande corpusafhankelijke skip. De oorspronkelijke resultaten hieronder blijven staan als historische auditbasis. De uitgebreide standalone-HTTP-proef, koude hersteltest, Linux-kernelisolatie en Chromium-browserproeven slagen op bovengenoemde commit.

Lokale eindcontrole: 518 tests geslaagd, nul gefaald, één bestaande skip en twee bestaande TODOs, over 117 testbestanden. ESLint: nul fouten/waarschuwingen. De Next.js-productiebuild inclusief TypeScript slaagt. De HTTP- en browsertests slagen, inclusief de kwaadaardige DOCX-controle en echte accountwissel/uitlogflows. OSV meldt voor 968 productie- en buildpackages geen bekende kwetsbaarheden op het controlemoment. De skip/TODOs tellen niet als geaccepteerde productiefunctionaliteit.

Reproduceerbare commando's:

```sh
npm ci
npm run security:audit -- --all
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
node scripts/check-preview-security.mjs
node scripts/check-standalone.mjs --browser
# Alleen op een disposable Linux-host met systemd:
sudo "$(command -v node)" scripts/check-linux-isolation.mjs
```

Lokaal getest op Windows met Node 24 en een geïsoleerde headless Edge. De geslaagde CI gebruikt Linux, Node 22 en Chromium. De browsertests gebruiken een tijdelijke database met twee synthetische accounts en blokkeren externe browserverzoeken. Ze gebruiken geen persoonlijk browserprofiel. De volledige installatie op de echte VM vereist nog een eigen acceptatie.

## Verplichte stappen vóór livegang

1. Laat deze fixes reviewen en behoud de verplichte groene CI bij merge naar `main`. De hierboven vastgelegde branchcommit is reeds geslaagd.
2. Maak een staging-VM en valideer de nginx- en systemd-configuratie daar. Test HTTPS, uitsluitend loopback voor poort 3000, de firewall, SSH, overschreven forwardingheaders, upload-/tijdlimieten en het schoolnetwerkscenario met gedeelde IP-adressen.
3. Draai de nieuwe parserisolatie-acceptatie op de gekozen Linux-host en test echte bestanden/corpusbelasting binnen de ingestelde geheugen- en tijdgrenzen. De configuratie is nu aanwezig; de daadwerkelijke VM moet die instellingen nog afdwingen.
4. Controleer op staging dat de B2B-processen stoppen bij disconnect/deadline en dat providerbudgetten passen bij het gebruik. De repository bevat nu de harde processtop en regressietests; dit vervangt geen providerlimieten of operationele belastingtest.
5. Test een volledige versleutelde offsite-backup en herstel op een lege host, inclusief avatars, gebruikers, sleutelintrekking, quota en benodigde secrets. Configureer waarschuwingen voor mislukte backups, schijfvulling, OOM/restarts en 5xx/429.
6. Stel echte providerbudgetten, beperkte credentials en rotatie in. Verifieer e-mailbezorging, corpusbeschikbaarheid en de belangrijkste lesflows op staging. Dit is niet met echte provideraccounts getest.

## Bronnen

- [Next.js securityrelease augustus 2026](https://nextjs.org/blog/august-2026-security-release): gepatchte frameworkversie en bekende impact.
- [js-yaml GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh): getroffen en gepatchte versies.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): beoordelingskader voor bestandverwerking en isolatie.
- [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html): CSP als aanvullende beveiligingslaag.

De concrete applicatiebevindingen komen uit de lokale code en bovengenoemde regressieproeven, niet uit de algemene bronnen.

## Verdieping van de onderzoeksgrenzen

Op verzoek van de eigenaar zijn de lokaal uitvoerbare grenzen verder onderzocht. De eerdere audit bleef geldig; deze ronde voegt gerichte negatieve tests toe en heeft twee aanvullende robuustheidsproblemen gevonden.

| ID | Bevinding | Herstel en bewijs |
| --- | --- | --- |
| SEC-08 — laag, robuustheid | Vijf account-routes vertrouwden op TypeScript-casts voor JSON. Ongeldige JSON en oversize bodies veroorzaakten onbehandelde fouten; onjuiste veldtypes werden niet consistent geweigerd. Er is geen accountovername aangetoond. | Runtime-schema's voor profiel, consent, pins, eigen keys en modellenlijst. Ongeldige input geeft 400, oversize 413 en bodytimeout 408, met generieke no-store-antwoorden. De tien negatieve routetests faalden vóór herstel en slagen daarna. Bestaande key-instellingen blijven werken. |
| SEC-09 — laag, beschikbaarheid | Volle/geblokkeerde sessionStorage veroorzaakte een onbehandelde fout in de splashstatus; de browser bleef vóór het inlogformulier steken. Dit is in een geïsoleerde Edge gereproduceerd. | De optionele animatiestatus gebruikt een geheugenfallback. Een regressietest simuleert falende get/set/remove. Privéopslag blijft afzonderlijk fail-closed: bij een ontoegankelijke opslag verschijnt een herstelmelding zonder accountinhoud. |

Daarnaast wordt de gedeelde-computerkeuze nu vóór OTP-verificatie opgeslagen. Als die keuze niet kan worden vastgelegd, wordt geen verificatieverzoek verstuurd dat ondertussen wel een nieuwe sessie zou kunnen aanmaken. De browserproef gebruikt gesimuleerde OTP-antwoorden en verstuurt geen e-mail.

Uitgebreide controles in deze ronde:

- Echte HTTP-methodes op elf account-/sessieroutes: ongeldige cookies, vervalste proxyheaders, opaque `Origin: null`, cross-origin en `Sec-Fetch-Site: cross-site` worden geweigerd. Ongeldige JSON wordt via de gebouwde productieapp gecontroleerd.
- Twee synthetische accounts: extra `userId`, `id` en e-mailvelden of queryparameters kunnen profiel/consent van het andere account niet wijzigen. SQL-metatekens worden als tekst opgeslagen; de andere gebruiker blijft bestaan. HTML in de profielnaam wordt geweigerd.
- Dertig deterministische documentmutaties: lege, afgeknotte, bytegewijzigde en verlengde DOCX/ODT/PDF/DOC/RTF-invoer wordt in begrensde childprocessen afgehandeld. Na iedere reeks slaagt een normale vervolgjob. Dit is een gerichte mutatieproef, geen volledige fuzzcampagne of representatieve collectie echte Office-documenten.
- Browserprivacy: volle opslag tijdens inloggen, expliciete weigering bij ontoegankelijke privéopslag en opnieuw openen na logout, naast de bestaande accountwissel-, offline- en twee-tabbladenproeven. De uitgebreide proef slaagt lokaal in Edge en in Linux-CI met Chromium.
- De kwaadaardige Word-previewproef slaagt in Chromium, Firefox en WebKit in Linux-CI. WebKit is geen volledige acceptatie van Safari op een echt Apple-apparaat.

De uitgebreide suite slaagt in Linux-CI met **550 tests in 123 bestanden**, nul fouten en één bestaande corpusafhankelijke skip. Lokaal is de splashregressie apart uitgevoerd bovenop de volledige 549-test-run. [CI-run 35378685841](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/35378685841) bevestigt bovendien lint, typecheck, build, dependencycontrole, kernelisolatie, HTTP-/browserproeven en koude apphersteltest. De drie previewengines zijn ieder afzonderlijk geslaagd. Latere documentatiecommits veranderen deze geteste code niet.

Nog afhankelijk van de toekomstige omgeving: echte e-mailbezorging/providerfacturatie, grote echte document-/corpuscollecties, VM-firewall/HTTPS/SSH en versleuteld offsite-herstel op een lege host. Onbekende kwetsbaarheden, alle browsercrash-/herstelvarianten en de inhoudelijke betrouwbaarheid van AI zijn hiermee niet uitgesloten.

## Afronding van wat zonder VM en echte datasets kan

De eigenaar bevestigde dat er nog geen volledige curriculumcorpora beschikbaar zijn. De repository bevat nu `npm run check:corpora`, een alleen-lezen controle op de veertien productiepaddefinities. Deze valt niet terug op fixtures en geeft exitcode 1 bij ontbrekende, lege, beschadigde of onleesbare JSONL. De huidige werkmap meldt alle veertien bestanden als ontbrekend, zoals verwacht. Tests controleren ook echte tijdelijke bestanden en een te grote regel. De data is niet gefabriceerd of gedownload; een corpusafhankelijke zoektest blijft terecht overgeslagen.

De niet-SDK-providerpaden zijn verder begrensd: modellenlijsten en Cloudflare-JSON worden tot maximaal 1 MiB gelezen en modellenlijsten krijgen runtime-validatie. Een afgebroken modellenaanvraag stopt ook het upstream-verzoek. Brevo-foutbodies worden niet ingelezen of teruggekaatst; statusinformatie volstaat. Deze rechtstreekse credentialdragende verzoeken volgen geen redirects. Dit is aanvullende hardening tegen foutieve upstream-antwoorden, geen bewijs van een eerder uitgebuite aanval.

**SEC-10 — laag, foutinformatielek:** bij een mislukte AI-provider kon de router diens oorspronkelijke fouttekst via de publieke foutformatter teruggeven. Een regressie met één Groq-provider en een synthetische privéwaarde in de fouttekst faalde vóór herstel. De router geeft nu uitsluitend een vaste foutmelding terug; providerbody's, interne details en eventuele echo's van aanvraaginhoud komen daar niet meer in voor. Dit bewijst een doorgeefpad, niet dat een echte provider ooit een sleutel heeft teruggestuurd.

Provider-/e-mailproeven simuleren succes, 401/429/500, netwerkfalen, ontbrekende configuratie, misvormde en te grote antwoorden, vastlopende streams en annulering. Geen echte e-mail of betaald providerverzoek is verstuurd. Echte bezorging, provideracceptatie/facturatie, representatieve documenten en corpuskwaliteit wachten op de benodigde accounts en bestanden. Review/merge blijft bij de eigenaar; er is geen VM nodig om deze codefixes te beoordelen.

Eindvalidatie van deze code: [CI-run 35383458537](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/35383458537) slaagt volledig met **568 tests in 126 bestanden**, nul fouten en één bestaande corpusafhankelijke skip. Ook lint, typecheck, productiebuild, OSV-controle van 968 packages, HTTP-autorisatiegrenzen, Linux-kernelisolatie, koude apphersteltest, Chromium-browserprivacy en de Word-previewproeven in Chromium, Firefox en WebKit slagen. De afzonderlijke corpuscontrole meldt de veertien ontbrekende productiebestanden; dit is een nog te vervullen datavereiste, geen geslaagde corpusacceptatie. Latere wijzigingen aan uitsluitend dit verslag veranderen deze geteste code niet.
