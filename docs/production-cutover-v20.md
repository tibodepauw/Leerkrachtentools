# v5.20 follow-up cutover

Deze notitie is de uitrolvolgorde. Ze is geen toestemming om te migreren of te deployen.

## Welke remote voedt productie

Productie volgt **GitHub** `https://github.com/tibodepauw/Leerkrachtentools`, branch **`main`**.

| Remote | `main` | Rol |
|--------|--------|-----|
| GitHub `tibodepauw/Leerkrachtentools` | productie | CI (`ci.yml` op `main` en pull requests), GitHub Releases. Live process start is handmatig |
| Origin `tibo-dev/Leerkrachtentools` | niet productie | Cloud-agent werkcopy. Origin `main` kan achterlopen (v5.19.0 terwijl GitHub `main` al v5.20.1 is) |

Merge-base voor deze fixes: GitHub `main` commit `5b071d35474207583e2999926f7e77e724ca131b` (v5.20.0). Open de pull request tegen **GitHub `main`**, niet tegen Origin `main`. Force-push GitHub `main` niet.

Er is geen productiemigratie of deployment zonder expliciet akkoord. GitHub-merge en GitHub Release zijn niet hetzelfde als live start.

## Merge versus deployment

Mergen van de follow-up naar GitHub `main` start **geen** productie-deployment.

- In de repo staat alleen `.github/workflows/ci.yml`. Die job doet audit, `next typegen`, lint, typecheck, Vitest en production build. Er is geen deploy-job, geen `vercel.json`, en geen hook die `node .next/standalone/server.js` herstart.
- Dit GitHub-repo is niet gekoppeld als Vercel-project (andere `tibodepauw`-repo's wel). Origin-merge voedt productie niet.
- README-productie blijft: `npm run build`, daarna `PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js`.

Volgorde na review en akkoord: backup, daarna `QUOTA_LEDGER_BACKUP_CONFIRMED=1 npm run migrate:quota-ledgers`, daarna gecontroleerde start van één instance op de nieuwe build. Merge alleen is niet die start. Zet de live process pas na de migratie op de follow-upbuild.

Als buiten deze repo een auto-deploy bestaat (git-pull op de VM, Watchtower, of een hostingkoppeling die hier niet in de tree staat), zet die eerst uit. Anders is mergen wél live, en dan klopt backup, migratie, start niet meer.

## Open tickets (blijven open)

Deze ronde sluit ze **niet**.

- **V20-08** (leases / worker-kill): per-request leases, immutable periode, owner-heartbeat en AbortSignal zitten in de follow-upcode. Resterend: geen geïsoleerde worker-kill; werk dat AbortSignal negeert of CPU-gebonden blijft kan doorlopen tot lease-expiry. Dat is niet bewezen als onbegrensde exploit op de huidige handlers, maar het ticket blijft open.
- **H-01** Gedeeld-apparaatmodus
- **H-02** Logout over tabbladen
- **H-03** PDF/DOC-parserisolatie
- **H-04** Avatar hercoderen
- **H-05** B2B-sleutellevenscyclus
- **H-06** Releasechecks en operationele limieten

Details: `docs/audit-v20-followup.md`, `docs/hardening-h01-h06.md`.

## Wat de app niet doet

De app past de quota-ledger-backfill **niet** automatisch toe. `getDatabase()` waarschuwt alleen als er nog maandlogs of AI-rijen zijn en de marker `v20_quota_ledger_backfill_v1` ontbreekt. Schemawijzigingen (zoals `opened_at`) mogen wel bij start.

## Volgorde: backup, migratie, gecontroleerde start

Voer dit pas uit na akkoord, op een kopie van de productiedatabase eerst.

1. **Stop gecontroleerd** het schrijvende app-proces (één SQLite-writer). Laat geen tweede instance tegen hetzelfde bestand starten.
2. **Backup** van `data/leerkrachtentools.db` plus `-wal` en `-shm` als die bestaan. Bewaar de kopie buiten het volume. Controleer dat de backup opent (`sqlite3 backup.db "PRAGMA integrity_check;"`).
3. **Zet `QUOTA_LEDGER_EPOCH_MS`** op de Unix-tijd (ms, of seconden als de waarde `<= 1e12`) van de eerste v5.20-productiestart wanneer bestaande `api_org_quota.opened_at` 0 is. Zonder betrouwbare scheiding weigert de migratie als een organisatie zowel billable logs als een ledger in dezelfde UTC-maand heeft. `max(ledger, alle logs)` is geen automatische fallback: drie oude gelogde calls plus twee nieuwe ongelogde ledger-units zouden 3 worden in plaats van 5.
   Alleen als de epoch onbekend blijft, keur je een gedocumenteerde reconciliatie goed:
   - `QUOTA_LEDGER_RECONCILE=sum-pre-ledger`: huidige logs zijn allemaal van vóór het ledger. Telling = logs + ledger. Juist voor 3 gelogd + 2 ongelogd. Dubbelt als nieuwe calls ook in `api_usage_logs` staan.
   - `QUOTA_LEDGER_RECONCILE=max-overlap`: nieuwe verbruik staat ook in de logs. Telling = max(ledger, logs). Kan ongelogd nieuw verbruik laten vallen.
4. **Migreer eenmalig** met de backupbevestiging:

   ```bash
   QUOTA_LEDGER_BACKUP_CONFIRMED=1 npm run migrate:quota-ledgers
   ```

   Verwacht `v20_quota_ledger_backfill_v1 applied=true` de eerste keer, daarna `applied=false` zonder extra telling.
   Gebruik dezelfde `AUTH_SECRET` als de app (minstens 32 tekens). Anders krijgen AI-budgetrijen een andere HMAC en tellen ze naast de bestaande subjects.
5. **Gecontroleerde start** van één instance. Controleer logs op de backfill-waarschuwing (die moet weg zijn), een B2B-call, en dat `consumed` niet sprong naar de som van ledger plus alle logs.

Telregel: 2xx en 5xx tellen; 4xx en 429 niet. AI-rijen gaan via e-mail-HMAC naar `ai_budget_usage`, bewaren `user_ai_usage.id` als `source_event_id`, en slaan bestaande bron-events over. Twee oude records in dezelfde milliseconde blijven twee eenheden.

## Rollback

Geen schema-downgrade script. Rollback is restore van de backup van stap 2.

1. Stop de app.
2. Zet `leerkrachtentools.db`, `-wal` en `-shm` terug uit de backup.
3. Start de vorige bekende goede build (GitHub `main` `5b071d3` / v5.20.0 als deze follow-up nog niet live mag).
4. Start de follow-upbuild niet opnieuw tegen de herstelde database tot de marker en de data opnieuw kloppen. Een herstelde DB zonder marker mag de migratie opnieuw krijgen na een nieuwe backup.

Als de marker al gezet is en de telling fout is: restore, niet handmatig `consumed` bijstellen en de marker laten staan.

## Checks op het merge-resultaat

GitHub Actions `ci.yml` op de pull request naar GitHub `main`: production-dependency audit, `next typegen`, lint, typecheck, Vitest, production build. Groen CI is geen deployment. De branch bevat `5b071d3`; het merge-resultaat is de branch-tip.
