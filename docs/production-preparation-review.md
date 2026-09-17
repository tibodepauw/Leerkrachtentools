# Voorbereidingsreview — 17 september 2026

Branch: `codex/production-preparation`, gebaseerd op GitHub-main na merge van PR #2 (`1f9b0df`). De gebruiker heeft die merge zelf uitgevoerd. Er staat nog niets live; er is geen deployment, productiebackfill of uitgebreide nieuwe securityaudit uitgevoerd.

## PR #2

De vijf applicatiewijzigingen zijn doorgenomen: API-guard, orgquota, schemavoorbereiding, historische quota-backfill en begrensd body-lezen. Gerichte regressies op een ongewijzigd archief van head `49d779b`: 64 geslaagd, twee bestaande TODOs. Volledige suite op dat archief: 499 geslaagd, één Git-bestandenlijstcontrole faalde omdat het archief zelf niet tracked is, één skipped en twee TODOs. Die identieke corpuscontrole slaagde afzonderlijk in de echte checkout. GitHub CI op dezelfde head was groen. Geen nieuw blokkerend reviewpunt gevonden binnen deze scope.

## Nieuwe wijzigingen

- Gedeelde-computerkeuze, tijdelijke les-/documentopslag, meldingen tussen tabbladen en serverrevalidatie bij terugkeer.
- Foutafhandeling bij logout en browseropslag; inhoud blijft verborgen wanneer de sessie niet bevestigd is.
- PDF/DOC-parsers in aparte processen. Een aanvankelijke worker-threadvariant kon met native PDF-dependencies de testhost beëindigen en is vervangen door procesisolatie. Geldige en ongeldige PDF's plus afbreking zijn getest.
- Avatar hercoderen naar begrensde WebP zonder metadata; atomair vervangen; geen browsercache voor avatars.
- Sleutels met standaardverval, expliciete scopes, uitgifte aan bestaande organisaties, transactionele rotatie/intrekking en metadata-audittrail. Budget blijft behouden; ingetrokken sleutels kunnen geen cacheantwoord ophalen.
- Cancellation door B2B/Pro/providerketen; geen providerfallback na externe abort; heartbeats behouden de lease van werkelijk nog lopend werk.
- Gepinde Actions, Dependabot, CI-timeout en standalone HTTP-smoke-test.
- DigitalOcean/nginx/systemd-voorbeelden en consistente SQLite-backuphelper.

## Uitgevoerde controles

Windows, Node 24.19.0. Lokale native dependencies zijn gecontroleerd; de npm-installatie gebruikte bestaande prebuilds omdat de Windows node-gyp-launcher bleef hangen. Dit vervangt de Linux-CI-installatie met `npm ci` niet.

- Vitest: 508 geslaagd, 0 gefaald, 1 skipped, 2 TODOs; 115 bestanden. De skips/TODOs zijn geen geslaagde acceptatie van V20-08 of ontbrekende corpusdata.
- ESLint en TypeScript: geslaagd.
- Next.js-productiebuild: geslaagd; standalone static/public-assets gekopieerd.
- Standalone HTTP-test met eigen tijdelijke database en synthetische sessie: sessiecontrole, geldige PDF-import, ongeldige PDF-weigering en logout geslaagd. De test verstuurt geen e-mail en roept geen AI-provider aan.
- OSV: 317 productiepackages gecontroleerd; geen bekende kwetsbaarheden gemeld op het testmoment.
- SQLite-backup van synthetische WAL-database: integriteitscheck en teruglezen van de testwaarde geslaagd.

## Grenzen

De DigitalOcean-templates zijn nog niet op Linux geactiveerd of getest. Browseracceptatie met echte tabbladen, volledige document-/afbeeldingscollecties, per-job native geheugen-/OS-isolatie, B2B hard-stop, dev/build-dependencybeleid, providerbudgetten, operationele alarmen en een volledige offsite-herstelproef blijven vervolgwerk. Zie `hardening-h01-h06.md` en `digitalocean-first-deployment.md`.

De eigenaar verzorgt GitHub-branchbescherming. De connector heeft leesrechten maar weigert PR-schrijfacties; Git-push naar een aparte branch is wel beschikbaar. Deze review is geen verklaring dat de site bugvrij of klaar voor publieke productie is. De afgesproken uitgebreide securityaudit begint pas na het startsignaal.
