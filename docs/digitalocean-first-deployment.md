# Eerste installatie op DigitalOcean (nog niet live)

Status 18 september 2026: er staat volgens de eigenaar nog niets live. De repositoryaudit en aanvullende fixes staan in [het auditrapport](security-audit-2026-09-18.md). De volledige Linux-CI, inclusief parserisolatie, browsers en koude apphersteltest, is [geslaagd](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/35373352643). Review/merge en acceptatie op de echte staging-VM blijven nodig. Geen deployment is uitgevoerd.

## Nieuwe installatie

- Gebruik een ondersteunde Ubuntu LTS, Node 22 of 24, een aparte `leerkrachtentools`-servicegebruiker zonder login en één app-instance. Reserveer voldoende geheugen boven de 2 GiB servicegrens voor OS en nginx (bijvoorbeeld een VM met 4 GiB); meet corpus- en uploadbelasting voordat je de grens aanpast.
- Bouw een gereviewde commit met `npm ci`, de CI-checks en `npm run build`. Zet de inhoud van `.next/standalone` in een root-owned releasefolder onder `/opt/leerkrachtentools/releases/`, met `current` als verwijzing. Het proces mag de code niet wijzigen. Voorzie een schrijfbare `.next/cache` alleen als image-optimisatie die nodig heeft.
- Maak `/var/lib/leerkrachtentools` eigenaar van de servicegebruiker, mode 0700. Verbind `current/data` met die map: de database, avatars en lokaal aangeleverde corpora moeten buiten de release blijven bestaan. Zet `DATABASE_PATH=/var/lib/leerkrachtentools/leerkrachtentools.db`.
- Plaats echte secrets uitsluitend in `/etc/leerkrachtentools/app.env` (root-owned, mode 0600). Gebruik verschillende willekeurige waarden van minstens 32 tekens voor `AUTH_SECRET` en `API_KEY_ENCRYPTION_SECRET`. Stel `APP_ORIGIN=https://<eigen domein>` in, echte Brevo-afzenderinstellingen en alleen de gekozen AI-providers. `ALLOW_DEV_LOGIN_CODE=false`. Geen voorbeeldsecrets gebruiken.
- Een lege database krijgt bij de eerste start het schema. Voer geen historische quota-backfill of reconciliatie uit voor een nieuwe installatie. Wordt later toch een bestaande database geïmporteerd, volg dan `production-cutover-v20.md` op een kopie.
- Laad de benodigde curriculumcorpora afzonderlijk. Ze staan bewust niet in Git; een geslaagde build bewijst niet dat alle zoeknetwerken gegevens bevatten. Test elk aangeboden onderwijsniveau met echte controlevragen.

## Corpusbestanden controleren vóór deployment

De eigenaar heeft bevestigd dat de volledige corpora nog niet beschikbaar zijn. Voer na levering vanuit de repository uit:

```sh
npm run check:corpora
# Of wijs expliciet een aangeleverde datamap aan:
npm run check:corpora -- --data-root /pad/naar/data
# Alleen voor een bewust afgebakende deelcontrole:
npm run check:corpora -- --required OPSTAP,ZILL
```

De controle gebruikt de productiepaddefinities van de app, zonder testfixtures als vervanging. Ze leest streaming, telt JSON-objecten en weigert ontbrekende, lege, onleesbare of beschadigde bestanden en regels groter dan 1 MiB. Bij een fout is de exitcode 1. Er worden geen gegevens gedownload, gewijzigd of inhoudelijk afgedrukt. Zonder selectie worden alle veertien verwachte datasets gecontroleerd. Een deelcontrole bewijst niets over de niet-geselecteerde onderwijsnetwerken; beperk het aanbod of lever ook die data aan. Geldige JSONL bewijst nog geen volledigheid, actualiteit of goede zoekresultaten: voer daarna echte controlevragen uit.

## Netwerk en proces

`deploy/leerkrachtentools.service` en `deploy/nginx.conf.example` zijn templates. Pas domein, certificaten en Node-pad aan. Controleer vóór activering met `systemd-analyze verify` en `nginx -t` op de VM. Ze zijn niet op een echte DigitalOcean-VM getest.

Laat Node alleen op 127.0.0.1:3000 luisteren. Open in de DigitalOcean-firewall alleen HTTPS/HTTP voor bezoekers en SSH uitsluitend voor beheeradressen; open poort 3000 niet. Gebruik SSH-sleutels. Activeer beveiligingsupdates en volg herstartmeldingen op.

Nginx overschrijft forwarded-IP-headers; pas daarna `TRUST_PROXY_IP_HEADERS=true` toe. De limieten gelden per publiek IP: test een schoolnetwerk met veel gebruikers voordat je de loginlimiet aanscherpt. Stel providerbudgetten en waarschuwingen in de dashboards van de gebruikte AI-aanbieders in.

De appgrens van 2 GiB omvat maximaal vier B2B-childprocessen. Document- en avatarjobs krijgen een aparte systemd-slice van maximaal 1 GiB, per job maximaal 512 MiB (inclusief native geheugen), twee gelijktijdige jobs en een harde looptijd van 10 seconden. Houd op een 4-GiB-VM dus ook ruimte voor OS/nginx en meet de werkelijke corpusbelasting.

## Documentservice installeren

Gebruik de Linux-build van dezelfde gereviewde commit als de app. Kopieer de vier parserbestanden naar systemd/tmpfiles en controleer de configuratie vóór activering:

```sh
sudo install -m 0644 deploy/leerkrachtentools-parser.socket /etc/systemd/system/
sudo install -m 0644 deploy/leerkrachtentools-parser@.service /etc/systemd/system/
sudo install -m 0644 deploy/leerkrachtentools-parsers.slice /etc/systemd/system/
sudo install -m 0644 deploy/leerkrachtentools-parser.tmpfiles /etc/tmpfiles.d/leerkrachtentools-parser.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/leerkrachtentools-parser.conf
sudo systemd-analyze verify /etc/systemd/system/leerkrachtentools-parser.socket /etc/systemd/system/leerkrachtentools-parser@.service /etc/systemd/system/leerkrachtentools-parsers.slice
sudo systemctl daemon-reload
sudo systemctl enable --now leerkrachtentools-parser.socket
```

De groep `leerkrachtentools` moet al bestaan. Pas het Node-pad aan als Node niet onder /usr/bin staat en bind uitsluitend dat runtimebestand als het buiten /usr staat. De socket is alleen toegankelijk voor root en de appgroep. Bind nooit de hele release of de hele datamap in de parser-root. Optionele formuliertemplates worden afzonderlijk read-only gemount; houd ze toegankelijk voor de dynamische gebruiker zonder de overige appdata te openen. De appservice zet `DOCUMENT_WORKER_SOCKET=/run/leerkrachtentools-parser.sock`. Stel de lokale ontwikkeloptie niet in op een publiek domein.

Test eerst op een disposable Linux-host met systemd: `sudo "$(command -v node)" scripts/check-linux-isolation.mjs`. Deze proef maakt tijdelijke units, test filesystem-/netwerkweigering, kernel-timeout en native OOM, en voert vervolgens de echte standalone-smoke test uit. De tijdelijke units en bestanden worden opgeruimd. Dit is geen installatie van de productieservice.

Bouw na workerwijzigingen opnieuw met `npm run build`; start geen oude workerbundels. Stel `ORG_AI_DAILY_LIMIT` en `ORG_AI_GLOBAL_DAILY_LIMIT` bewust in (standaard 100 per organisatie en 500 totaal, UTC-dag). Daarnaast begrenst `SERVER_AI_DAILY_CALL_LIMIT` werkelijke server-key-pogingen van web, queryherschrijving en B2B samen (standaard 500 per UTC-dag). `DISCOVERY_DAILY_CALL_LIMIT` begrenst nieuwe Google-zoekaanroepen (standaard 1000). Begin op staging met beide nieuwe limieten op `0`; verhoog ze bewust na configuratie van providerbudgetten. Nul of ongeldige configuratie schakelt de betreffende externe dienst uit. Providerdashboard-limieten blijven nodig, ook omdat een provider reeds aangenomen werk kan factureren nadat een lokale job is gestopt. Zie ook de [VirtualBox-testvolgorde en privacy-/kostencontrole](privacy-cost-review-2026-09-18.md).

## Backups, alarmen en releasecontrole

Maak een consistente SQLite-backup via de backup-API (ook met WAL actief):

```sh
node scripts/backup-database.mjs /var/lib/leerkrachtentools/leerkrachtentools.db /veilige-backupmap/lt-2026-09-17.db
```

Het script weigert overschrijven, opent de backup opnieuw en controleert integriteit. De standalone-smoke test herstelt daarnaast een synthetische backup naar een tweede database en start een nieuwe app: sessies, ontsleuteling van opgeslagen credentials, sleutelintrekking, quota, AI-budget en avatarbytes blijven correct. Dit is lokaal en op Linux-CI bevestigd.

Plan dagelijkse backups en versleutelde opslag buiten de VM. Bewaar avatars en benodigde secrets afzonderlijk versleuteld; behoud bij herstel dezelfde AUTH_SECRET en API_KEY_ENCRYPTION_SECRET. Kies een bewaartermijn, bijvoorbeeld 7 dagelijkse en 4 wekelijkse backups. Test de werkelijke offsite-backup op een lege staginghost. De repositoryproef bewijst nog niet dat die opslag, overdracht en operationele herstelprocedure werken.

Configureer een externe HTTPS-monitor en waarschuwingen voor service-restarts/OOM, 5xx, aanhoudende 429's, schijfgebruik boven 80%, geheugen en mislukte backups. Log geen lesinhoud, tokens of OTP-codes. Beperk toegang en retentie van nginx- en journald-logs.

Vóór livegang: login/logout in twee tabbladen, gedeelde-computermodus, lesimport/export, geldige/ongeldige PDF en DOC, avatar, alle aangeboden corpora, eigen API-sleutel, serverbudget en B2B-rotatie testen. Controleer HTTPS, CSP, proxyheaders, requestgrenzen en proceslimieten op de echte staginghost. Houd een vorige release en geteste backup beschikbaar.

Volg de open productievoorwaarden uit het auditrapport. Groen CI alleen is geen verklaring dat de productieomgeving veilig of bugvrij is.
