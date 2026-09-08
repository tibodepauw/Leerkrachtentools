# v5.20 follow-up tickets

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

Negatief vóór fix: synthetische URL leverde een grote download zonder abort. Daarna: URL-strings geweigerd vóór de SDK; geldige base64 wordt één keer naar begrensde bytes gedecodeerd.

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

Resterend werk, expliciet open: geen geïsoleerde worker-kill; handlers die AbortSignal negeren of CPU-gebonden blijven kunnen doorlopen tot lease-expiry. Niet bewezen als onbegrensde exploit op de huidige productiehandlers. Dit ticket is niet gesloten in deze ronde.

## V20-06 Migratie

Oorzaak: nieuwe ledgers startten leeg; een v5.19-only som mist unlogged v5.20-verbruik of telt overlapping logs dubbel.

Bestanden: `lib/db/migrateQuotaLedgers.ts`, `scripts/migrate-quota-ledgers.ts`, `docs/production-cutover-v20.md`.

Negatief vóór fix: oude usage-rijen lazen als 0; `ledger + alle logs` zou overlapping nieuwe rijen dubbel tellen; `max(ledger, logs)` bij onbekende start laat unlogged nieuw verbruik vallen (3 gelogde oude calls + 2 ongelogde nieuwe = 3 in plaats van 5). Daarna: versioned, transactionele, herhaalbare backfill. Gemengd met bekende start (`opened_at` of `QUOTA_LEDGER_EPOCH_MS`): oude billable logs plus `max(ledger, nieuwe logs)`. Onbekende start met zowel logs als ledger: weigering, geen marker, tot epoch of expliciete `QUOTA_LEDGER_RECONCILE` (`sum-pre-ledger` of `max-overlap`). Telregel: 2xx en 5xx tellen, 4xx/429 niet. AI-rijen via e-mail-HMAC, bestaande `(subject, created_at)` blijven uniek. Productie: backup, daarna `QUOTA_LEDGER_BACKUP_CONFIRMED=1 npm run migrate:quota-ledgers`, daarna gecontroleerde start. De app past de backfill niet automatisch toe. Mergen naar GitHub `main` start alleen `ci.yml`, geen live process. Geen productiemigratie zonder akkoord. V20-08 en H-01 tot H-06 blijven open.

## H-01 tot H-06 (blijven open)

Zie `docs/hardening-h01-h06.md`. H-01, H-02, H-03, H-04, H-05 en H-06 zijn niet geïmplementeerd en blijven open.
