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

## V20-04, V20-05, V20-08 Leases

Oorzaak: completion herberekende de UTC-maand; `updated_at` werd ook door denials ververst; timeout decrementeerde in-flight terwijl de handler doorliep.

Bestanden: `lib/api/orgQuota.ts`, `lib/api-guard.ts`.

Negatief vóór fix: maandwissel verlaagde de verkeerde teller; 429-retries hielden slots vast; timeout zette in-flight op 0 met lopend werk. Daarna: per-request lease met immutable periode en owner-heartbeat; denials verlengen geen lease; timeout houdt de lease tot late completion of expiry; AbortSignal naar de handler. Bestaande match/audit/improve-handlers krijgen het signal; harde worker-kill is niet gebouwd.

## V20-06 Migratie

Oorzaak: nieuwe ledgers startten leeg.

Bestanden: `lib/db/migrateQuotaLedgers.ts`, `scripts/migrate-quota-ledgers.ts`.

Negatief vóór fix: oude usage-rijen lazen als 0. Daarna: versioned, transactionele, herhaalbare backfill op een synthetische v5.19-DB. Telregel: 2xx en 5xx tellen, 4xx/429 niet. AI-rijen via e-mail-HMAC. Productie: eerst backup, daarna `npx tsx scripts/migrate-quota-ledgers.ts`. Start de app de migratie niet automatisch.

## H-01 tot H-06

Zie `docs/hardening-h01-h06.md`. Niet in deze wijziging geïmplementeerd.
