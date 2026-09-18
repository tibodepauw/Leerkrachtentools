# Securityaudit vóór de eerste productie-installatie

Datum: 18 september 2026. Baseline: `main` op `3a23381158ec724b580fbf9d703f0da571fec51f`, inclusief PR #3. Herstelbranch: `codex/security-audit`. Er is geen deployment uitgevoerd. Alle actieve proeven gebruikten lokale synthetische gegevens; er zijn geen echte e-mails verstuurd of AI-providerverzoeken gedaan.

## Oordeel

De repository bevatte drie reproduceerbare applicatieproblemen: beïnvloeding van de appopmaak vanuit een Word-preview, een vastlopende ODT-tekstbewerking en databankgroei door reeds geweigerde OTP-pogingen. Deze zijn op de herstelbranch opgelost. Daarnaast is een kwetsbare builddependency bijgewerkt en zijn uploadcapaciteit, afbreking van AI-verzoeken en de dependencycontrole aangescherpt.

Dit rapport is geen vrijgave voor publieke productie. De fixes moeten worden gereviewd en Linux-CI moet op deze branch slagen. Daarna zijn de hieronder beschreven VM- en herstelproeven nodig. Een codeaudit kan de daadwerkelijke serverconfiguratie of afwezigheid van alle onbekende fouten niet bewijzen.

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

## Onderzochte onderdelen

| Onderdeel | Controle en resultaat | Grenzen |
| --- | --- | --- |
| Login en sessies | OTP-hashing, pogingslimiet, willekeurige sessietokens, server-side intrekking, cookieopties, productie/dev-scheiding en e-mailtoegangslijsten doorgenomen. De productie-HTTP-proef weigert ontbrekende sessies en ongeldige B2B-sleutels. | Echte Brevo-bezorging en publiek misbruikvolume niet getest. Het globale OTP-noodplafond kan bij een verdeelde aanval legitieme aanmeldingen blokkeren. |
| Autorisatie en CSRF | Centrale guard, moduletoegang en accountgebonden queries doorgenomen. HTTP-proeven op 25 beschermde API-paden weigeren ongeauthenticeerde aanvragen, cross-origin mutaties en vervalste middlewareheaders; accountverwijdering zonder Origin wordt geweigerd. B2B met ongeldig Bearer-token krijgt 401. | Dit is een gerichte matrix, geen bewijs voor iedere mogelijke HTTP-normalisatie of elk toekomstig endpoint. |
| B2B, quota en replay | Scope, verval/intrekking, rotatie, organisatiebudget, gebonden idempotency-digests, gelijktijdigheid, leases en begrensde logs bekeken. Bestaande regressies lopen mee. | V20-08: willekeurige synchrone handlercode kan niet door een JavaScript-timer hard worden gestopt. Zie resterende risico's. |
| Uploads en uitvoer | Bestandsgrootte/signatures, werkelijke ZIP-inflatie, paden, parserprocessen, avatardecodering, preview-DOM en React-uitvoer bekeken. Synthetische geldige/ongeldige PDF en ODT en kwaadaardige Word-opmaak getest. | Geen volledige fuzzcampagne; niet iedere echte DOC/DOCX/PDF-variant getest. PDF-weergave vertrouwt op de browserviewer. |
| Geheimen en database | Parameterbinding in onderzochte queries, sessiehashes, AES-GCM-contextbinding voor providerkeys, gerichte accountqueries en gegevensverwijdering bekeken. Patroonscan van 2.011 unieke tekstblobs uit lokaal opgehaalde Git-refs: één match, een bewust ongeldige testfixture met `abc` als private key; geen echte sleutel in die scan bevestigd. | De scan herkent geselecteerde sleutelpatronen, geen willekeurig geheim of verwijderde/onbereikbare remote objecten. VM-secrets en dashboards zijn niet ingezien. |
| AI en externe verzoeken | Providerhosts zijn code/configuratiegebonden; gebruikers geven geen vrije fetch-URL aan de upload-SDK door. Base64 wordt naar begrensde bytes omgezet. Gestructureerde uitvoer wordt gevalideerd, er zijn geen modeltools voor systeemacties in de onderzochte router. | Promptinjectie kan de inhoud van een analyse beïnvloeden. Modeluitvoer blijft advies; er is geen garantie op inhoudelijke juistheid. |
| Browserprivacy | Tests voor gedeelde opslag, sessiemeldingen en werkelijke browseracceptatie zijn toegevoegd. Serviceworker cachet geen API-antwoorden of accountpagina's; analytics replay staat uit. | Geen Safari/Firefox-acceptatie, echte browsercrash/heropenen of juridische privacybeoordeling. Normale apparaatmodus bewaart lessen lokaal volgens de bestaande productkeuze. |
| Supply chain en GitHub | Next.js 16.3.3 is de gepatchte augustusversie. Actions zijn op SHA gepind, tokenrechten zijn beperkt en credentials worden niet in de checkout bewaard. GitHub bevestigt `main` beschermd met verplichte `quality` voor iedereen; baseline-main-CI is groen. | Nieuwe branch moet nog door Linux-CI. Dependabot-majorupdates zijn niet automatisch gemerged. Release-tagbeleid moet bij een release worden ingesteld. |
| VM en backups | Nginx/systemd-templates, forwardingvertrouwen, bindadres, limieten en SQLite-backuphelper doorgenomen. | Templates zijn geen bewijs van een draaiende firewall, HTTPS of restore. Die infrastructuur is nog niet beschikbaar in deze audit. |

## Validatie

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
```

Lokaal getest op Windows met Node 24 en een geïsoleerde headless Edge. CI gebruikt Linux, Node 22 en Chromium. De browsertests gebruiken een tijdelijke database met twee synthetische accounts en blokkeren externe browserverzoeken. Ze gebruiken geen persoonlijk browserprofiel. De volledige Linux-installatie en de echte VM vereisen nog een eigen acceptatie.

## Verplichte stappen vóór livegang

1. Laat deze fixes reviewen en de volledige Linux-CI slagen voordat ze naar `main` gaan.
2. Maak een staging-VM en valideer de nginx- en systemd-configuratie daar. Test HTTPS, uitsluitend loopback voor poort 3000, de firewall, SSH, overschreven forwardingheaders, upload-/tijdlimieten en het schoolnetwerkscenario met gedeelde IP-adressen.
3. Sluit parserisolatie verder af. PDF/DOC-childprocessen delen momenteel de servicegebruiker en diens leesrechten. Een schone procesomgeving geeft **geen** OS-sandbox: een parserexploit kan nog bij leesbare appdata. Native geheugen valt niet onder de JS-heapgrens; de systemd-grens geldt voor de hele service. DOCX/ODT-verwerking bevat bovendien nog code in het hoofdproces. Test en implementeer een aparte, minimaal bevoegde parserdienst/container met harde limieten voordat onbetrouwbare uploads breed worden opengesteld.
4. Behandel V20-08 als open: de deadline vraagt afbreking en actieve taken behouden hun lease, maar willekeurige CPU-code of code die abort negeert heeft nog geen eigen harde processtop. De huidige schemas begrenzen invoer; dat vervangt procesisolatie niet.
5. Test een volledige versleutelde offsite-backup en herstel op een lege host, inclusief avatars, gebruikers, sleutelintrekking, quota en benodigde secrets. Configureer waarschuwingen voor mislukte backups, schijfvulling, OOM/restarts en 5xx/429.
6. Stel echte providerbudgetten, beperkte credentials en rotatie in. Verifieer e-mailbezorging, corpusbeschikbaarheid en de belangrijkste lesflows op staging. Dit is niet met echte provideraccounts getest.

## Bronnen

- [Next.js securityrelease augustus 2026](https://nextjs.org/blog/august-2026-security-release): gepatchte frameworkversie en bekende impact.
- [js-yaml GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh): getroffen en gepatchte versies.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): beoordelingskader voor bestandverwerking en isolatie.
- [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html): CSP als aanvullende beveiligingslaag.

De concrete applicatiebevindingen komen uit de lokale code en bovengenoemde regressieproeven, niet uit de algemene bronnen.
