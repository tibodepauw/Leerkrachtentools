# v5.20 follow-up tickets

> Statusupdate 19 september 2026: de opeenvolgende herstelrondes zijn gemerged en opgenomen in [v5.21.0-rc.1](releases/v5.21.0-rc.1.md). Onderstaande resultaten, branchstatus en vervolgpunten zijn een historische momentopname, geen actuele openstaande-takenlijst. Zie de [documentatie-index](README.md) en [installatiehandleiding](digitalocean-first-deployment.md) voor de huidige baseline en resterende productieacceptatie.

Update 18 september, tweede herstelronde: procesisolatie voor document/beeldverwerking, harde stop voor de drie productie-B2B-routes en echte organisatie-AI-dagbudgetten zijn toegevoegd op `codex/security-audit`. De volledige Linux-CI inclusief kernelisolatie, browsers en koude hersteltest slaagt. Zie [actueel auditrapport](security-audit-2026-09-18.md). Eerdere openstaande-codebeschrijvingen hieronder zijn historisch; review/merge en acceptatie op de toekomstige VM blijven apart.

Opvolging 17 september 2026: zie `docs/hardening-h01-h06.md` voor de nieuw uitgewerkte voorbereiding. De historische V20-08-beschrijving hieronder is deels ingehaald: route-, Pro- en Cloudflare-cancellation en actieve lease-heartbeats zijn toegevoegd. Een geïsoleerde harde stop voor willekeurige B2B-handlercode blijft open. Er is nog niets live; de uitgebreide nieuwe securityaudit wacht op het startsignaal van de eigenaar.

Auditbasis: v5.20.0, commit `5b071d35474207583e2999926f7e77e724ca131b`. Oude SEC-03 tot SEC-13 en BUG-01 zijn niet opnieuw als open behandeld. SEC-01 en SEC-02 bleven open en zijn hier hersteld.

Geen claims over productie-WAF, proxy, live PostHog of compliance buiten de uitgevoerde tests.

## V20-03 TypeScript en linked_curriculum

Oorzaak: `matchCurriculumGoals` gaf een payloadobject terug; audit indexeerde nog `[0]`. `JSZipObject.internalStream` zat niet in de JSZip-typings.

Bestanden: `lib/b2b/auditCurriculum.ts`, `lib/documents/extractText.ts`, `test/api-v1.test.ts`.

Negatief vóór fix: audit miste `linked_curriculum` terwijl match resultaten had; `tsc` faalde. Daarna: echte auditroute bevat `linked_curriculum` als de matcher een resultaat heeft; ZIP-misbruiktests blijven weigeren.

## V20-01 en V20-07 Idempotency

Oorzaak: cachekey was `(org_id, idempotency_key)` zonder principal, endpoint of bodydigest. Bodies >64k tekens werden als fout-JSON onder HTTP 200 bewaard.

Bestanden: `lib/api/orgQuota.ts`, `lib/api/idempotency.ts`, `lib/api-guard.ts`, `lib/db/ensureFollowupSchema.ts`.

Negatief vóór fix: `goals:improve` kon auditdata replayen; gewijzigde body gaf stil het oude antwoord; grote auditreplay werd `{error}` met 200. Daarna: principal + methode + endpoint + digest; conflict 409; replay identiek; te lange keys 400; oude cache rijen worden gedropt. Quota blijft per organisatie.

## SEC-01 URL-uploads

Oorzaak: `fileData`/`audioData` waren vrije strings; de SDK kon een URL downloaden zonder de provider-timeout van 12 seconden.

Bestanden: `lib/ai/binaryUpload.ts`, `lib/ai/inputValidation.ts`, `lib/ai/router.ts`, `app/api/extract-manual/route.ts`, `app/api/transcribe-reflection/route.ts`.

Negatief vóór fix: synthetische URL leverde een grote download zonder abort. Daarna: URL-strings geweigerd vóór de SDK; geldige base64 wordt begrensd gedecodeerd vóór de SDK (validatie en route mogen elk decoderen; geen onbeperkte allocatie in het geteste pad).

Onzekerheid: geen live 2 GiB-download of interne SSRF-test. Private-URL-blokkering van de SDK is niet opnieuw bewezen.

## SEC-02 Multipart-totaal

Oorzaak: `request.formData()` zonder ruwe bytegrens, zonder Content-Length.

Bestanden: `lib/http/requestBody.ts`, import- en exportroutes, avatarroute.

Negatief vóór fix: klein TXT + 9 MiB genegeerd veld gaf 200. Daarna: ruwe body telt alle velden vóór parsing.

Onzekerheid: geen reverse-proxy of Next.js-hostinglimiet gemeten.

## V20-02 Security events

Oorzaak: elke denial schreef een `security_events`-rij; prune liep vooral bij reserve.

Bestanden: `lib/security/events.ts`, `lib/api/orgQuota.ts`, `lib/api-guard.ts`.

Negatief vóór fix: 20 denials, 20 events. Daarna: sampling cap 8 plus windowteller; prune op denials; writerfout onderbreekt 429 niet.

## V20-04 en V20-05 Leases (periode en denial-heartbeat)

Oorzaak: completion herberekende de UTC-maand; `updated_at` werd ook door denials ververst.

Bestanden: `lib/api/orgQuota.ts`, `lib/api-guard.ts`.

Negatief vóór fix: maandwissel verlaagde de verkeerde teller; 429-retries hielden slots vast. Daarna: per-request lease met immutable periode; denials verlengen geen lease.

## V20-08 Leases / worker-kill (blijft open)

Timeout houdt de lease tot late completion of expiry en geeft AbortSignal aan de handler. Bestaande match/audit/improve-handlers krijgen het signal.

**Bevestigd in het geteste venster (geen restwerk meer onder deze bullets):**

- Bij een stream-timeout blijft de lease actief tot de responsebody is uitgelezen. Direct na de publieke 429: één actieve lease. Na het uitlezen van de body: nul actieve leases. Dit is geen worker-kill.
- D1-02: een gewone handlerrejection is geen timeoutcache. Eerste antwoord en replay zijn dezelfde publieke 500.

**Nog open restwerk (PR1-05 / V20-08):**

- Harde stop: geen geïsoleerde worker-kill. Abort-negerend of CPU-gebonden werk kan na de publieke timeout en na lease-expiry doorlopen. De producer van een gestreamde body kan na de 429 nog data leveren.
- Volledige cancellationketen: `context.signal` gaat niet door de huidige routes naar `matchCurriculumGoals`, Pro-analyse of `runStructured`. Het Cloudflare-pad combineert het externe signal niet met zijn eigen timeout. `heartbeatOrgApiCall` bestaat, maar de normale guarduitvoering roept die niet aan.
- Lease-expiry verandert de ledgerstatus, niet het uitvoerende werk. Een actief blijvende lease tot bodyafronding bewijst niet dat eindeloos werk hard wordt beëindigd.

De huidige B2B-routes geven gewone JSON terug. Dit is geen bewezen exploit op die endpoints. Dit ticket is niet gesloten. Eindcontrole: `docs/EINDCONTROLE_D1_2026-09-09.md`.

## V20-06 Migratie

Oorzaak: nieuwe ledgers startten leeg; een v5.19-only som mist unlogged v5.20-verbruik of telt overlapping logs dubbel.

Bestanden: `lib/db/migrateQuotaLedgers.ts`, `scripts/migrate-quota-ledgers.ts`, `docs/production-cutover-v20.md`.

Negatief vóór fix: oude usage-rijen lazen als 0; `ledger + alle logs` zou overlapping nieuwe rijen dubbel tellen; `max(ledger, logs)` bij onbekende start laat unlogged nieuw verbruik vallen (3 gelogde oude calls + 2 ongelogde nieuwe = 3 in plaats van 5). Daarna: versioned, transactionele, herhaalbare backfill. Gemengd met bekende start (`opened_at` of `QUOTA_LEDGER_EPOCH_MS`): oude billable logs plus `max(ledger, nieuwe logs)`. Onbekende start met zowel logs als ledger: weigering, geen marker, tot epoch of expliciete `QUOTA_LEDGER_RECONCILE` (`sum-pre-ledger` of `max-overlap`). Telregel: 2xx en 5xx tellen, 4xx/429 niet. AI-rijen via e-mail-HMAC en `user_ai_usage.id` als `source_event_id`, zodat twee oude calls in dezelfde milliseconde twee eenheden blijven. Live rijen die die bron-id al dragen worden overgeslagen. Live rijen zonder `source_event_id` met alleen dezelfde `(subject, created_at)` zijn ambigu: default weigering, geen marker. `QUOTA_LEDGER_AI_NULL_SOURCE_OVERLAP=claim` behandelt de live-rij als dat ene oude event; `insert` houdt de live-rij en voegt oude events ernaast in. Timestampgelijkheid is geen herkomstbewijs. Een bestaande marker `v20_quota_ledger_backfill_v1` wordt niet verwijderd en herstelt eerder fout gemigreerde data niet. Productie: backup, daarna `QUOTA_LEDGER_BACKUP_CONFIRMED=1 npm run migrate:quota-ledgers`, daarna gecontroleerde start. De app past de backfill niet automatisch toe. Mergen naar GitHub `main` start alleen `ci.yml`, geen live process. Geen productiemigratie zonder akkoord. V20-08 en H-01 tot H-06 blijven open.

## H-01 tot H-06 (blijven open)

Zie `docs/hardening-h01-h06.md`. H-01, H-02, H-03, H-04, H-05 en H-06 zijn niet geïmplementeerd en blijven open.

## CONTROL-mapping (oorspronkelijke vijf)

Dit zijn bestaande tests, geen nieuwe suite-naam `CONTROL`. URL-upload, multipart-bytes, 409, unknown-start en `linked_curriculum` overlappen deels, maar zijn niet dezelfde vijf cases. Mapping:

1. Cross-key-autorisatie via echte audit/improve-routes, plus gewijzigd-bodyconflict
   - `lib/api/orgQuota.test.ts` `levert geen auditdata via een goals:improve-sleutel met dezelfde Idempotency-Key`: echte `POST` van `/api/v1/curriculum/audit` en `/api/v1/goals/improve`; improve-sleutel krijgt 403 op audit; daarna 200 audit; improve met dezelfde header is geen replay en bevat de geheime titel niet; `consumed === 2`.
   - `lib/api/orgQuota.test.ts` `geeft 409 bij dezelfde Idempotency-Key en een gewijzigde body`: dummy match-handler, 409, `consumed === 1`.
   - `lib/api/orgQuota.test.ts` `geeft 409 op de echte auditroute bij dezelfde Idempotency-Key en een gewijzigde body`: echte auditroute, 409, `consumed === 1`.
2. Sampling van deniallogs en windowteller
   - `lib/api/orgQuota.test.ts` `groeit niet onbeperkt bij een reeks 429's`: 20 denials; `api_usage_logs` en `security_events` `<= API_DENIAL_LOG_CAP` (8); `denial_logs_written <= 8`; `denial_count === 20`.
3. Completion over maandgrens, dubbele completion en herstel van verlopen leases
   - `lib/api/orgQuota.test.ts` `rondt een reservering af op de geboekte periode na een maandwissel`: September-lease completed in oktober verlaagt september-`inFlight`; dubbele completion van dezelfde lease is een no-op; oktober-slot blijft tot zijn eigen complete.
   - `lib/api/orgQuota.test.ts` `herstelt vastgelopen slots ondanks denialverkeer`: vier leases blokkeren; na 120s plus denials is een nieuwe reserve ok.
4. Geweigerde URL, ongeldige base64 en begrensde geldige bytes
   - `lib/ai/binaryUpload.test.ts` `herkent URL-strings`, `weigert URL-strings als uploadveld`, `decodeert geldige kleine base64 binnen de bytegrens`, `weigert ongeldige base64`.
   - `app/api/extract-manual/route.test.ts` `stuurt geen URL-string naar de SDK`, `stuurt gedecodeerde bytes voor geldige base64`.
   - Multipart-bytegrens (apart van deze CONTROL-case): `app/api/import-lesson-document/route.test.ts` `telt genegeerde velden mee vóór formData-parsing`.
5. Weigering bij onbekende gemengde migratiestart, ongewijzigd budget, geen marker
   - `lib/db/migrateQuotaLedgers.test.ts` `weiger drie oude gelogde calls en twee nieuwe ongelogde calls zonder starttijd`: `applied === false`, `refused === true`, `consumed` blijft 2, marker ontbreekt.
   - `linked_curriculum` hoort bij V20-03, niet bij deze vijf: `test/api-v1.test.ts` assert `payload.coverage[0]?.linked_curriculum`.

PR1-05 / V20-08 blijft open voor harde stop, volledige cancellationketen en lease-expiry. De bevestigde deellease (streamtimeout houdt de lease tot de body is uitgelezen) heeft een acceptatietest in `lib/api/orgQuota.test.ts` en `review-evidence/independent-d1.test.ts`. De producer kan na de publieke 429 nog data leveren; dat is restwerk, geen worker-kill. De acht PR1-tests vervangen de CONTROL-cases niet één-op-één.

## D1-01 Usage-log en D1-02 handlerfoutcache

Oorzaak D1-01: vroege quota-completion zette `completeInFinally = false` en sloeg daardoor ook `logApiUsage` over. Daarna: aparte `logExecutedWork`-vlag. Eén usage-log per echte uitvoering; replay logt niet. Een falende logwriter verandert response of consumed niet.

Oorzaak D1-02: `handlerFinished` stond alleen in `.then`, dus een gewone rejection liep het timeoutcachepad in (eerste 500, replay 429). Daarna: time-out alleen als de deadline-timer afgaat; rejection wordt als publieke 500 opgeslagen en teruggegeven. Late completion overschrijft een al opgeslagen antwoord niet (`status = 'pending'`). Onafhankelijke eindcontrole: `docs/EINDCONTROLE_D1_2026-09-09.md`. D1-01 en D1-02 zijn daar bevestigd hersteld. V20-08 blijft open voor harde stop, cancellationketen en lease-expiry.
