# Eerste installatie op DigitalOcean (nog niet live)

Status 18 september 2026: er staat volgens de eigenaar nog niets live. De repositoryaudit en aanvullende fixes staan in [het auditrapport](security-audit-2026-09-18.md). Review, Linux-CI op de auditbranch en een Linux-stagingtest moeten nog plaatsvinden. Geen deployment is uitgevoerd.

## Nieuwe installatie

- Gebruik een ondersteunde Ubuntu LTS, Node 22 of 24, een aparte `leerkrachtentools`-servicegebruiker zonder login en één app-instance. Reserveer voldoende geheugen boven de 2 GiB servicegrens voor OS en nginx (bijvoorbeeld een VM met 4 GiB); meet corpus- en uploadbelasting voordat je de grens aanpast.
- Bouw een gereviewde commit met `npm ci`, de CI-checks en `npm run build`. Zet de inhoud van `.next/standalone` in een root-owned releasefolder onder `/opt/leerkrachtentools/releases/`, met `current` als verwijzing. Het proces mag de code niet wijzigen. Voorzie een schrijfbare `.next/cache` alleen als image-optimisatie die nodig heeft.
- Maak `/var/lib/leerkrachtentools` eigenaar van de servicegebruiker, mode 0700. Verbind `current/data` met die map: de database, avatars en lokaal aangeleverde corpora moeten buiten de release blijven bestaan. Zet `DATABASE_PATH=/var/lib/leerkrachtentools/leerkrachtentools.db`.
- Plaats echte secrets uitsluitend in `/etc/leerkrachtentools/app.env` (root-owned, mode 0600). Gebruik verschillende willekeurige waarden van minstens 32 tekens voor `AUTH_SECRET` en `API_KEY_ENCRYPTION_SECRET`. Stel `APP_ORIGIN=https://<eigen domein>` in, echte Brevo-afzenderinstellingen en alleen de gekozen AI-providers. `ALLOW_DEV_LOGIN_CODE=false`. Geen voorbeeldsecrets gebruiken.
- Een lege database krijgt bij de eerste start het schema. Voer geen historische quota-backfill of reconciliatie uit voor een nieuwe installatie. Wordt later toch een bestaande database geïmporteerd, volg dan `production-cutover-v20.md` op een kopie.
- Laad de benodigde curriculumcorpora afzonderlijk. Ze staan bewust niet in Git; een geslaagde build bewijst niet dat alle zoeknetwerken gegevens bevatten. Test elk aangeboden onderwijsniveau met echte controlevragen.

## Netwerk en proces

`deploy/leerkrachtentools.service` en `deploy/nginx.conf.example` zijn templates. Pas domein, certificaten en Node-pad aan. Controleer vóór activering met `systemd-analyze verify` en `nginx -t` op de VM. Ze zijn niet op een echte DigitalOcean-VM getest.

Laat Node alleen op 127.0.0.1:3000 luisteren. Open in de DigitalOcean-firewall alleen HTTPS/HTTP voor bezoekers en SSH uitsluitend voor beheeradressen; open poort 3000 niet. Gebruik SSH-sleutels. Activeer beveiligingsupdates en volg herstartmeldingen op.

Nginx overschrijft forwarded-IP-headers; pas daarna `TRUST_PROXY_IP_HEADERS=true` toe. De limieten gelden per publiek IP: test een schoolnetwerk met veel gebruikers voordat je de loginlimiet aanscherpt. Stel providerbudgetten en waarschuwingen in de dashboards van de gebruikte AI-aanbieders in.

De servicegrens geldt voor app plus parserprocessen. Parserprocessen hebben daarnaast een deadline van 8 seconden, een JS-heapgrens van 128 MiB en maximaal twee gelijktijdige jobs. Native allocaties vallen niet onder de JS-heaplimiet. Een volledige sandbox en per-job native geheugenlimiet zijn nog vervolgwerk.

## Backups, alarmen en releasecontrole

Maak een consistente SQLite-backup via de backup-API (ook met WAL actief):

```sh
node scripts/backup-database.mjs /var/lib/leerkrachtentools/leerkrachtentools.db /veilige-backupmap/lt-2026-09-17.db
```

Het script weigert overschrijven, opent de backup opnieuw en controleert integriteit. Plan dagelijkse backups en versleutelde opslag buiten de VM. Bewaar avatars en benodigde secrets afzonderlijk versleuteld. Kies een bewaartermijn, bijvoorbeeld 7 dagelijkse en 4 wekelijkse backups. Test herstel in een aparte stagingomgeving: accounts, quota, intrekking en avatarbestanden. Alleen een integriteitscheck is nog geen volledige hersteltest.

Configureer een externe HTTPS-monitor en waarschuwingen voor service-restarts/OOM, 5xx, aanhoudende 429's, schijfgebruik boven 80%, geheugen en mislukte backups. Log geen lesinhoud, tokens of OTP-codes. Beperk toegang en retentie van nginx- en journald-logs.

Vóór livegang: login/logout in twee tabbladen, gedeelde-computermodus, lesimport/export, geldige/ongeldige PDF en DOC, avatar, alle aangeboden corpora, eigen API-sleutel, serverbudget en B2B-rotatie testen. Controleer HTTPS, CSP, proxyheaders, requestgrenzen en proceslimieten op de echte staginghost. Houd een vorige release en geteste backup beschikbaar.

Volg de open productievoorwaarden uit het auditrapport. Groen CI alleen is geen verklaring dat de productieomgeving veilig of bugvrij is.
