# Dependency- en privacyvalidatie — 19 september 2026

## Scope en basis

Deze ronde bouwt voort op `main` commit `be23d58` (na PR #5).
De nieuwe Dependabot-PR's #14–#18 zijn gezamenlijk beoordeeld op deze aparte
auditbranch. De eerdere audits worden hiermee aangevuld, niet vervangen.
Er zijn geen echte API-sleutels, betaalde AI-aanvragen, mails of klantgegevens gebruikt.

## Gereproduceerde problemen en fixes

### SEC-13: AI SDK-antwoorden hadden geen eigen bytegrens

De directe Cloudflare- en modellijst-aanvragen waren begrensd, maar de vier
SDK-transports blokkeerden alleen redirects. Een synthetisch HTTP 200- of
HTTP 500-antwoord van 3 MiB werd volledig ingelezen. Beide regressietests
faalden vóór de correctie.

`credentialFetch` begrenst nu alle gebruikte, niet-streamende SDK-antwoorden
op 1 MiB en 12 seconden, gecombineerd met annulering door de aanroeper.
Dit geldt ook voor foutantwoorden. De transportlaag annuleert te grote of
vastgelopen bodies en houdt de foutmelding vrij van de providerinhoud.
Redirects blijven verboden. Tests dekken werkelijke en opgegeven grootte,
succes- en foutstatus, annulering, eigen deadline en geldige antwoorden.
Dit begrenst geheugen- en verwerkingsexposure; het draait al door de provider
gemaakte kosten niet terug.

### SEC-14: analytics-filter beschermde verzending, maar niet alle lokale opslag

Een echte PostHog-browserproef toonde dat privé-eventproperties vóór
`before_send` in SDK-browseropslag konden worden gezet. De verzending was
wel opgeschoond. De opslagassertie faalde vóór de correctie.

Analytics gebruikt nu `disable_persistence: true`, bewaart geen referrers of
campagneparameters en behoudt de bestaande allowlist voor pageviews.
De browsertest gebruikt de echte React-provider en PostHog-SDK, onderschept
alle netwerkverzoeken en controleert synthetische privéwaarden uit URL,
fragment, documenttitel, DOM, referrer en eventproperties. Ook vooraf
gevulde oude SDK-opslag wordt gecontroleerd na initialisatie.
Er worden twee echte, opgeschoonde pageviews waargenomen; geen privéwaarden
in het onderschepte transport of de resterende browseropslag.

De browserproef simuleert een normale user-agent en `webdriver: false`, omdat
de SDK anders alle geautomatiseerde bezoeken als bot overslaat. De
productieconfiguratie en privacyfilter worden niet vervangen. Deze test
controleert niet de opslag of verwerking binnen een echte PostHog-account.
Met analytics ingeschakeld ontvangt de analyticsdienst nog steeds normale
netwerkmetadata zoals het bron-IP. Zonder projectkey blijft analytics uit.
Doordat analytics-identiteit niet meer permanent wordt bewaard, kunnen
herlaadbezoeken als nieuwe anonieme bezoekers worden geteld.

### Eerste pageview kon vóór initialisatie worden aangeroepen

De child-effect voor pageviews kon lopen voordat de parent-effect PostHog
initialiseerde. De SDK laat zo'n capture vallen. De pageview-component wordt
nu pas na initialisatie gemount. De browserproef eist expliciet dat de eerste
automatische pageview aankomt, vóór de handmatig geïnjecteerde test-events.

## Dependency-updates

| Onderdeel | Geteste lockversie |
| --- | --- |
| AI SDK core | 7.0.107 |
| Google-provider | 4.0.76 |
| Cerebras-provider | 3.0.53 |
| Groq-provider | 4.0.46 |
| OpenAI-compatibele provider (SambaNova) | 4.0.71 |
| PostHog | 1.434.2 |
| React en React DOM | 19.3.0, beide gelijk |
| Playwright | 1.63.0 |
| Vitest | 5.0.1 |

De lockversies zijn de door npm opgeloste versies binnen de voorgestelde
ranges. Ze zijn dus iets nieuwer dan enkele Dependabot-titels. Vier echte
provider-SDK's verwerken synthetische gestructureerde antwoorden correct,
sturen de ingestelde tokenlimiet mee en behouden redirectblokkering. Tests
gebruiken geen echte providerverbindingen.

Vitest 5 werkt met de eerder ingevoerde Node 22-types. Node 22.12+ of 24 is
nodig voor de ontwikkel-/testomgeving. React en React DOM zijn samen
bijgewerkt; de losse React DOM-update uit PR #16 zou verschillende versies
combineren. Dependabot groepeert voortaan React en de bijbehorende types.

Deze branch vervangt de voorgestelde wijzigingen uit #14–#18. Merge die
oude voorstellen niet daarnaast; controleer na merge van deze branch welke
Dependabot automatisch sluit en welke als vervangen kunnen worden gesloten.

## Validatie en grenzen

- Volledige lokale Vitest 5-suite: **611 geslaagd, 0 mislukt, 1 overgeslagen**
  in 133 testbestanden; de overgeslagen controle vereist ontbrekende corpusdata.
- TypeScript en ESLint geslaagd; nieuwe SDK- en privacytests inbegrepen.
- OSV: **960 productie- en buildpakketten**, geen bekende kwetsbaarheden gevonden.
- Productiebuild met de nieuwe dependencies geslaagd.
- Lokale standalone HTTP-/browserproef en koude hersteltest geslaagd, inclusief
  PDF, DOCX-export/herimport, avatars, B2B-routes en gedeelde-apparaatprivacy.
  De eerste lokale proef bereikte de parserdeadline bij een kleine PDF;
  een afzonderlijke herhaling slaagde met ongewijzigde veiligheidslimieten.
  Parserlatentie onder koude start en belasting blijft onderdeel van VM-acceptatie.
- Echte Edge/Chromium-browser: SDK-verzending, eerste pageview en opgeschoonde
  browseropslag getest met synthetische gegevens en volledig onderschept netwerk.
- De nieuwe analytics-browsertest is toegevoegd aan de bestaande Linux-CI,
  samen met de bestaande parserisolatie, herstel-, HTTP- en browsercontroles.
  De definitieve Linux-run moet nog slagen vóór merge.

Open voor de latere acceptatieomgeving: echte curriculumcorpora en documenten,
echte provideraccounts en budgetten, langdurige belasting, DigitalOcean-configuratie,
monitoring en extern back-upherstel. Deze ronde is geen productieverklaring.

## Bronnen

- [Vitest 5-migratie](https://main.vitest.dev/guide/migration/)
- [React vereist gelijke React/React DOM-versies](https://react.dev/errors/527)
- [AI SDK releases](https://github.com/vercel/ai/releases)
- [PostHog releases](https://github.com/PostHog/posthog-js/releases)
- Voor de transport- en opslagbevindingen is ook de daadwerkelijk geïnstalleerde
  SDK-broncode onderzocht en met gerichte regressies getest.
