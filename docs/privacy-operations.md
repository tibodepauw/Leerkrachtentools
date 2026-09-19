# Privacybeheer en gecontroleerde feiten — 19 september 2026

De wijzigingen gelden voor deze branch; de oudere release-/auditrapporten zijn historische testbewijzen. Geen deployment, productieopruiming, providerwissel of betaalde API-aanroep uitgevoerd. De publieke bedrijfswebsite is volgens de eigenaar nog niet bijgewerkt en geldt niet als bewijs van runtimegedrag.

## Vastgesteld versus onbekend

- Code: Gemini API (`@ai-sdk/google`); beschikbare serversleutels kunnen ook Groq, Cerebras, SambaNova en Cloudflare activeren. De router begrenst fallbackpogingen. Eigen gebruikerssleutels volgen hun gekozen provider. Werkelijk actieve sleutels en de koppeling aan het betaalde Google-project: **ONBEKEND**. Billing is door de eigenaar bevestigd, niet met een sleutel/projectcontrole.
- Optionele Google Discovery Engine zoekt met zoektermen in een ingestelde datastore; standaardlocatie in code is `global`, geen bewezen productieplaats. Geen Vertex AI-migratie van generatieve AI uitgevoerd.
- DigitalOcean is het voornemen. Alleen voorbeelden gevonden: `deploy/`, werkmap `/opt/leerkrachtentools/current`, env `/etc/leerkrachtentools/app.env`, database `/var/lib/leerkrachtentools/leerkrachtentools.db`. Actieve omgeving, regio, logrotatie, back-upbewaring en timerstatus: **ONBEKEND**.
- Er is geen aparte externe documentauditdienst aangetoond. `/api/full-audit` stuurt noodzakelijke lesinhoud via de gewone AI-router; `/api/v1/curriculum/audit` doet lokaal vergelijking en snelle matching, met tijdelijke B2B-antwoordopslag. Of er buiten deze repository een handmatige auditdienst, mailbox of gedeelde schijf is: **ONBEKEND**.
- Volledige curriculumcorpora ontbreken in deze werkmap. Code en fixturedata bewijzen geen daadwerkelijk geladen bronhouder/versie, verkrijgingswijze, licentie of toestemming voor AI-doorgifte. **ONBEKEND** per productiebron. Er is niets gescrapet, verwijderd of bijgekocht. Eerst bronmetadata en rechten bevestigen voor het aanbieden van de betreffende bron; vijf resultaten is geen auteursrechtelijke vrijstelling.
- PostHog: regio, DPA, werkelijke eventretentie **ONBEKEND**. `.env.example` houdt analytics uit. De keuzebalk werkt los van marketing en accountvoorwaarden. SDK-automatisering is vervangen door expliciete Capture API-verzoeken zonder queue/retry; intrekking abort lopende verzending. Netwerk-IP kan de leverancier bereiken. Configureer ook discard-IP in het project.
- Brevo: inlog-/feedbackmail bij configuratie; werkelijke accountlocatie, DPA en mail/logretentie **ONBEKEND**.

## Akkoordbewijs

`lib/legal/terms-2026-09-13.json` bewaart de daadwerkelijk gebruikte tekstversie, herkomst en ophaaldatum. `/voorwaarden` toont die snapshot. App-links gebruiken een versieparameter om eerder gecachte permanente redirects naar de oude bedrijfswebsite te vermijden. SHA-256 wordt berekend over de JSON van de tekstblokken. Een login-aanvraag moet de getoonde versie en het vinkje bevatten. Bewijs wordt pas aan de geverifieerde gebruiker gekoppeld; een volgende login overschrijft het eerste bewijs voor die tekst niet. Oude accounts krijgen geen fictief historisch akkoord. Bij wijziging: een nieuwe snapshot én versienummer maken; nooit bestaande tekst onder dezelfde versie wijzigen.

## Opruiming (voorbereid, niet uitgevoerd op productie)

Bouw met `npm run build:workers`. De standalone bevat `workers/privacy-maintenance.cjs` en benodigde dependencies. Gebruik een bestaand, expliciet absoluut databasepad; de CLI maakt of migreert geen database.

```sh
node workers/privacy-maintenance.cjs cleanup --database /var/lib/leerkrachtentools/leerkrachtentools.db
# Pas na gecontroleerde dry-run en herstelbare back-up:
node workers/privacy-maintenance.cjs cleanup --database /var/lib/leerkrachtentools/leerkrachtentools.db --apply
```

Dry-run opent alleen-lezen en toont aantallen, geen inhoud. Coderegels: verlopen inlogrecords na 24 uur (15-minuten misbruikvenster blijft intact); verlopen/inactieve sessies; AI- en requesttellers 48 uur; dagelijkse provider-/organisatietellers zeven dagen; API-/security-/feedbackmetadata 90 dagen; afgeronde idempotentie en leases 24 uur. Pending/actieve verzoeken blijven beschermd. Maandquota, akkoordbewijs en accountgegevens worden niet weggehaald. Oude `pending` records vragen eerst gecontroleerde afhandeling; niet handmatig wissen om opnieuw budget te krijgen.

`deploy/leerkrachtentools-cleanup.service` en `.timer` zijn optionele dagelijkse templates. Controleer werkelijk pad en dry-run vóór installatie/activering. Dit is geen back-up-, nginx- of journald-retentie; die moeten apart ingesteld worden. De codewaarden betekenen geen gegarandeerde verwijdering exact op het vervaltijdstip.

## Export en afsluiten

- Gebruiker: Instellingen → Mijn accountgegevens exporteren. `/api/account/export` gebruikt uitsluitend de actieve sessie, geen meegegeven gebruikers-id. Accountgegevens, versiegebonden akkoordbewijs en eigen gebruiksmetadata; geen keys, sessietokens, hashes, ruwe logs of andere accounts. Browserlessen en documenten hebben hun eigen export. Account verwijderen is een afzonderlijke bestaande handeling; tijdelijk gepseudonimiseerd AI-budget blijft behouden tegen quota-resetmisbruik.
- Organisatie: alleen de serverbeheerder met OS-toegang; controleer identiteit en bevoegdheid van de aanvrager vóór overdracht. Uitvoer buiten de webroot, privé-directoryrechten (Unix 0700, Windows beperkte ACL), versleutelde overdracht. Geen exportbestand in Git of back-up van de hele gedeelde database verstrekken.

```sh
node workers/privacy-maintenance.cjs export-org --database /absoluut/app.db --id ORG_ID --output /prive/export.json
node workers/privacy-maintenance.cjs export-user --database /absoluut/app.db --id USER_ID --output /prive/gebruiker.json
node workers/privacy-maintenance.cjs close-org --database /absoluut/app.db --id ORG_ID
# Afzonderlijke afsluiting, nooit impliciet bij export:
node workers/privacy-maintenance.cjs close-org --database /absoluut/app.db --id ORG_ID --apply --confirm-id ORG_ID
```

Export weigert bestaande uitvoerbestanden. Organisatie-export bevat eigen metadata, geen sleutelwaarden of tijdelijke antwoordinhoud. Afsluiten weigert lopend werk, trekt alle sleutels in, wist antwoordcache en blokkeert nieuwe sleutels/verzoeken voor die organisatie. Quota en contact-/contractmetadata blijven intact; definitieve verwijdering en bewaartermijn daarvan vragen een afzonderlijk onderbouwd besluit. Levering van een export is niet geautomatiseerd.

## Dashboardcontroles vóór activering

1. **PostHog (blokkeert alleen analytics):** controleer of het bestaande project onder `eu.posthog.com` of `us.posthog.com` staat; Settings → Project → Project API key en IP data capture configuration → Discard client IP data; Settings → Organization/Billing voor plan en bijbehorende eventretentie; leg toepasselijke DPA vast. Eventretentie is planbepaald, geen fictieve vrije slider. Vul pas daarna de publieke regio/host/retentiedagen en beide bevestigings-/enableflags in en herbouw. Geen accountmigratie of planwijziging uitgevoerd.
2. **Google (blokkeert verwerking met onbevestigde keys):** AI Studio → API keys → gekoppeld project; Cloud Console → datzelfde project → Billing en APIs & Services → Credentials/Quotas. Controleer betaalstatus, bedoelde sleutel en limieten. Eventuele Discovery Engine-datastore: project en locatie afzonderlijk bevestigen. Nooit sleutels kopiëren naar een chat of rapport.
3. **DigitalOcean (blokkeert livegang):** Droplets → gekozen VM → regio; Backups/Snapshots → schema en bewaarbeleid. Op de VM: werkelijk env/databasepad, `systemctl list-timers`, nginx-logrotatie, journald-bewaring en offsite-hersteltest. De VM bestaat nog niet: huidige onbekenden zijn open ingebruiknamestappen, geen bewijs van een huidig lek.
4. **Brevo/overige ingeschakelde leveranciers (vóór gebruik):** account-/contractgegevens, DPA, logs en bewaartermijn. Niet-geactiveerde leveranciers hoeven geen onnodige koppeling te krijgen.
5. **Bronnen (blokkeert die bronfunctie/B2B-aanbieding):** per werkelijk geladen corpus bronhouder, versie, herkomst, verkrijgingswijze, voorwaarden en recht op opslag/doorgifte vastleggen. Dit staat doorgaans bij de bronleverancier/overeenkomst, niet in DigitalOcean.

Officiële referenties: [GBA cookies](https://www.gegevensbeschermingsautoriteit.be/professioneel/thema-s/cookies), [PostHog Capture API](https://posthog.com/docs/api/capture), [PostHog opslag en IP-instelling](https://posthog.com/docs/privacy/data-storage), [PostHog GDPR](https://posthog.com/docs/privacy/gdpr-compliance), [Gemini API voorwaarden](https://ai.google.dev/gemini-api/terms).

## Uitgevoerde lokale validatie

- 629 geslaagde tests in 142 bestanden; één bestaande test met echte curriculumdata overgeslagen omdat die data ontbreekt.
- TypeScript, ESLint en productiebuild geslaagd.
- Chromium met onderschept netwerk: geen analytics vóór toestemming, na weigering, intrekking, herladen of verlopen keuze; onbevestigde configuratie blijft uit. Toegestane functie-events bevatten geen privé-inhoud, identiteit, referrer of gevoelige URL. Geblokkeerde browseropslag breekt de lesknop niet.
- Echte SQLite- en routeproeven: eerste akkoordbewijs behouden, geen verzonnen oud bewijs, export gescheiden per gebruiker/organisatie, geen secrets, dry-run zonder wijzigingen, lopend werk en quota beschermd, gesloten organisatie kan geen nieuwe sleutel/verzoek krijgen. Oude replay met tien resultaten geeft maximaal vijf terug.
- Standalone HTTP/browser: auth en CSRF op 25 endpoints, huidige lokale juridische pagina's zonder redirect, account-export met no-store, ingebouwde onderhouds-CLI, synthetische PDF/ongeldige uploads, DOCX-export/herimport, B2B-routes, avatar, logout/twee tabbladen en koude restore geslaagd.
- Deze lokale proeven zijn op Windows uitgevoerd. Linux-kernelisolatie en aanvullende Firefox/WebKit-proeven worden door de PR-CI uitgevoerd; ze bewijzen nog geen operationele VM-acceptatie.
