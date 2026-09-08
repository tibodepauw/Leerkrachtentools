# Leerkrachtentools v5.20.1

Quota-backfill, uploads en leases.

---

## Quota en idempotency

- B2B-audit vult `linked_curriculum` via `payload.results` als de matcher een treffer heeft
- Idempotency-cache is gebonden aan API-sleutel, methode, endpoint en bodydigest
- Grote idempotente antwoorden spelen het originele body terug, niet een foutobject met HTTP 200
- Herhaalbare ledger-backfill mengt pre-5.20 logs met een bestaand v5.20-ledger als `opened_at` of `QUOTA_LEDGER_EPOCH_MS` bekend is
- Gemengde maanden zonder betrouwbare start worden geweigerd; geen `QUOTA_LEDGER_RECONCILE` zonder akkoord
- Productie: backup, daarna `QUOTA_LEDGER_BACKUP_CONFIRMED=1 npm run migrate:quota-ledgers`, daarna gecontroleerde start
- Mergen naar GitHub `main` start alleen CI, geen live process

## Uploads en events

- AI-bestand- en audiovelden weigeren URL-strings en decoderen begrensde base64 vóór de SDK
- Import en export tellen de volledige multipart-body vóór het parsen
- ZIP-inflate met bytegrens gebruikt een runtime-gecontroleerde streamadapter
- Security-event-sampling gebruikt dezelfde denial-cap als usage-logs

## Leases

- API-leases houden hun geboekte maand, owner-heartbeat en late completion
- Denials verlengen geen stale slot
- Guard-timeout houdt de oorspronkelijke lease en geeft AbortSignal door
- V20-08 blijft open: geen geïsoleerde worker-kill
- H-01 tot H-06 blijven open

---

**Volledige changelog:** [CHANGELOG.md](https://github.com/tibodepauw/Leerkrachtentools/blob/main/CHANGELOG.md)
