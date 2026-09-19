# Leerkrachtentools — AI, curriculumzoeken en datastromen

Bijgewerkt op 19 september 2026 aan de hand van de code in **v5.21.0-rc.1**.
Dit is de actuele architectuuruitleg; auditbewijs en resterende productiecontroles
staan in de [documentatie-index](README.md).

## Actieve les en AI-acties

Modules delen één actieve les: context, doelgroep, doelen en lesfasen. De
gegevens staan per account in de browser. In gedeelde-computermodus blijven
lesgegevens, zoekresultaten en documentpreviews alleen in tabgeheugen en gaan ze
bij herladen of sluiten verloren. Exporteer werk vóór het sluiten.

Browseropslag betekent niet dat documenten nooit de computer verlaten:
documentimport en Word-export worden op de appserver verwerkt. AI-acties sturen
de gekozen invoer en relevante lescontext via de server naar een provider.
De scanner kan een PDF of afbeelding meesturen; reflectie kan audio meesturen.

De API controleert sessie, moduletoegang, invoer en toepasselijke gebruikslimieten.
De AI-router vraagt gestructureerde uitvoer op; Zod controleert het resultaat.
Ondersteunde providers zijn Google Gemini, Groq, Cerebras, SambaNova
(OpenAI-compatibel) en Cloudflare Workers AI. Beschikbare modellen hangen af van
de configuratie en provider. Multimodale routes geven Google voorkeur; niet elk
model ondersteunt bestanden of audio.

Met ingeschakelde eigen API-sleutels gebruikt de app uitsluitend de gekozen
gebruikersprovider. Een ontbrekende of niet-ontsleutelbare gebruikerssleutel valt
niet terug op serversleutels. Opgeslagen gebruikerssleutels zijn versleuteld en
gebonden aan account en provider.

De router probeert hoogstens twee providers met serversleutels, zonder automatische
SDK-retries. Per poging geldt maximaal 12 seconden, binnen een totale routerdeadline
van 45 seconden en eventuele kortere routegrenzen. De gebruikte niet-streamende
SDK-antwoorden zijn begrensd tot 1 MiB, ook bij fouten. Redirects zijn niet toegestaan.
Uitvoer is standaard maximaal 2400 tokens en nooit meer dan 4096; routes kunnen
een lagere limiet kiezen. Zie [router.ts](../lib/ai/router.ts) en
[credentialFetch.ts](../lib/http/credentialFetch.ts).

| Functie | API-route | Verwerking |
| --- | --- | --- |
| Handleiding Scanner | `/api/extract-manual` | Lescontext en doelen uit tekst of een ondersteund bestand halen |
| Doelverbeteraar | `/api/analyze-goals` | Doel beoordelen en zo nodig herschrijven |
| MC-DAS-SPM | `/api/classify-goal-taxonomy` | Doel classificeren zonder herschrijven |
| Schrijfstijl | `/api/format-dialogue` | Lesnotities naar de gekozen stijl omzetten |
| Taalfoutencheck | `/api/spellcheck` | Didactische taalcontrole |
| Timing | `/api/audit-timing` | AI-advies naast lokaal berekende minuten |
| Doel-activiteit | `/api/audit-alignment` | Activiteiten en evaluatie aan doelen koppelen |
| Betrokkenheid | `/api/audit-engagement` | Betrokkenheidsfactoren beoordelen |
| Totale audit | `/api/full-audit` | Gecombineerde didactische controle |
| Voice-reflectie | `/api/transcribe-reflection` | Tekst/audio verwerken en reflectie begeleiden |

## Curriculumzoeken: Snel en Pro

De huidige zoekpipeline gebruikt JSONL-corpora onder `data/`, met tokenindexering,
typo-tolerante matching en doelgroepweging. Corpora laden per onderwijsniveau.
De oude beschrijving van een demo met 18 seed-records en één cosinusscore is
niet meer van toepassing.

- **Snel** toont gerangschikte catalogustreffers. Lokale retrieval heeft geen
  generatief model nodig. Waar geconfigureerd kan Google Discovery Engine de
  zoekopdracht aanvullen of een semantische fallback leveren.
- **Pro** gebruikt opgehaalde kandidaten voor selectie en didactische toelichting
  door een taalmodel. Bij terugval vermeldt het antwoord dat Pro niet volledig
  werd uitgevoerd.
- **LLM-queryherschrijving** is een aparte, standaard uitgeschakelde instelling.
  Ingeschakeld kan ook Snel een AI-aanroep voor herschrijving doen; daarvoor
  gelden dezelfde sleutel- en quotaregels.

Browserroutes zijn `/api/rag-curriculum` en `/api/rag-minimum-goals`.
Netwerk- en niveaufilters omvatten basisonderwijs, secundair en de ondersteunde
AHOVOKS-domeinen. Zie [curriculumCorpus.ts](../lib/rag/curriculumCorpus.ts),
[corpusLevelCache.ts](../lib/rag/corpusLevelCache.ts) en
[runProCurriculumAnalysis.ts](../lib/rag/runProCurriculumAnalysis.ts).

Volledige corpora zitten niet in Git en zijn voor de komende installatie nog
niet beschikbaar. Kleine CI-fixtures bewijzen geen volledige dekking. Fetch- en
scraperscripts leveren afzonderlijk data aan; de optionele
`ONDERWIJSDOELEN_API_KEY` wordt door onderhoudsscripts gebruikt, niet als live
zoek-API van de webapp. Na aanlevering:

```sh
npm run check:corpora
npm run test:rag-benchmark
```

De eerste controle toetst verwachte bestanden en JSONL-structuur. Daarnaast zijn
inhoudelijke steekproeven met echte doelen nodig. Zie de
[installatiehandleiding](digitalocean-first-deployment.md) en
[bronnenlijst](curriculum-bronnen-urls.md).

Discovery Engine vereist `GOOGLE_PROJECT_ID`, `GOOGLE_CLIENT_EMAIL`,
`GOOGLE_PRIVATE_KEY` en `GOOGLE_DATA_STORE_ID`; `GOOGLE_LOCATION` is optioneel
(standaard `global`). Dit is een afzonderlijke dienst van de Gemini-sleutel
`GOOGLE_GENERATIVE_AI_API_KEY`. Houd private credentials buiten Git.

## Documenten en previews

Import (`/api/import-lesson-document`) ondersteunt PDF, DOC, DOCX, ODT, RTF,
TXT, MD en CSV, met maximaal 8 MiB invoer. Tekstextractie en Word-export
(`/api/export-lesson-document`) gebruiken geen taalmodel. De scanner is een
aparte AI-actie; Office-bestanden worden daarvoor eerst naar tekst omgezet.

Documentverwerking, Word-export en avatardecodering draaien in aparte processen.
Voor publieke productie is de private Linux/systemd-documentservice verplicht,
met bestand-, netwerk-, geheugen- en tijdgrenzen. Lokale ontwikkelprocessen
hebben niet dezelfde OS-isolatie. In `npm run dev` zonder die service moet
`DOCUMENT_WORKER_SOCKET` leeg zijn; een ingevuld pad probeert altijd die socket.
Zie [parserWorker.ts](../lib/documents/parserWorker.ts) en de installatiehandleiding.

Word-previews staan in een geïsoleerd iframe dat scripts, externe bronnen en
navigatie blokkeert. Word-export gebruikt een geüpload DOCX-formulier of een
apart aangeleverd sjabloon; een PDF wordt niet naar een bewerkbaar Word-formulier
omgezet. Avatars worden hercodeerd naar begrensde WebP zonder metadata.

## Privacy en opslag

| Gegeven | Opslag en verwerking |
| --- | --- |
| Actieve les en documentpreview | Accountgebonden browseropslag; gedeelde modus gebruikt tabgeheugen. Import/export verwerkt de inhoud ook op de appserver |
| Curriculumzoekcache | Accountgebonden sessionStorage; in gedeelde modus tijdelijk geheugen |
| AI-invoer | Via de appserver naar de gebruikte provider, inclusief relevante lescontext en eventueel bestand/audio |
| Profiel, sessies en gebruikerssleutels | SQLite; sessies gehasht, gebruikerssleutels versleuteld |
| Avatar | Hergecodeerd bestand op de server |
| B2B-toegang en verbruik | Gehashte sleutels, organisatiequota, gebruiks- en beveiligingsmetadata in SQLite |
| B2B-idempotency | Requestdigest en begrensd antwoord voor herhaling; dit kan ingezonden of gegenereerde doeltekst bevatten |
| Curriculumcorpora | Afzonderlijke serverbestanden; zoektermen kunnen naar Discovery Engine |
| Optionele analytics | Opgeschoonde vaste pageviews naar PostHog; geen permanente SDK-opslag, autocapture of replay |

Idempotency-antwoorden verlopen na 24 uur; opruiming gebeurt tijdens API- en
beveiligingsactiviteit. Dat garandeert geen verwijdering uit een ongebruikte
database op het exacte vervalmoment. Backups hebben een eigen bewaarbeleid nodig.
Zie [orgQuota.ts](../lib/api/orgQuota.ts).

Uitloggen en accountwisseling trekken clienttaken in en verhinderen dat late
resultaten onder een andere sessie worden opgeslagen. Andere tabbladen ontvangen
een sessiemelding en controleren opnieuw bij terugkeer. Accountverwijdering wist
de accountgebonden browseropslag in de huidige browser. Persoonlijke-apparaatmodus
is bedoeld voor een vertrouwd browserprofiel; kies gedeelde modus op gedeelde apparaten.

Zonder `NEXT_PUBLIC_POSTHOG_KEY` blijft analytics uit. De eventfilter verwijdert
onder meer queryparameters, fragmenten, referrers, titels en onbekende velden.
De ontvangende dienst kan nog netwerkmetadata ontvangen. Marketingtoestemming
is geen analyticsinstelling. Zie [de analyticsvalidatie](dependency-security-validation-2026-09-19.md).

## B2B en kostenbeperking

De routes `/api/v1/curriculum/match`, `/api/v1/curriculum/audit` en
`/api/v1/goals/improve` gebruiken scoped Bearer-sleutels en gedeelde
organisatiequota. Een nieuwe sleutel krijgt standaard 90 dagen geldigheid.
Rotatie bewaart het verbruik. De routes draaien in childprocessen die worden
gestopt bij deadline, disconnect of leaseverlies.

| Instelling | Standaard | Bereik |
| --- | --- | --- |
| `SERVER_AI_DAILY_CALL_LIMIT` | 500 | Server-key AI-pogingen van web, queryherschrijving en B2B samen |
| `DISCOVERY_DAILY_CALL_LIMIT` | 1000 | Nieuwe Discovery-zoekaanroepen |
| `BREVO_DAILY_EMAIL_LIMIT` | 500 | Login- en feedbackmailpogingen samen |
| `ORG_AI_DAILY_LIMIT` | 100 | B2B AI-budget per organisatie |
| `ORG_AI_GLOBAL_DAILY_LIMIT` | 500 | Gezamenlijk B2B AI-budget |

Deze dagplafonds volgen UTC en vervangen gebruikersquota en maandquota niet.
Mislukte of onzekere externe pogingen blijven meetellen. Het zijn aantallen,
geen europlafonds; eigen gebruikerssleutels vallen buiten het gedeelde
server-key-budget. Ook na annulering kan reeds aangenomen providerwerk kosten
veroorzaken. Configureer providerbudgetten en waarschuwingen afzonderlijk.

## Nog te accepteren

De pre-release heeft code-, Linux- en browsertests doorlopen. De echte VM,
volledige corpora, provideraccounts, belasting, monitoring en offsite-herstel
zijn nog niet geaccepteerd. Concrete vervolgstappen staan in de
[release-notities](releases/v5.21.0-rc.1.md).
