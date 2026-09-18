# Aanvullende controle van privacy en API-kosten

Baseline: gemergede audit, `main` op `9748d48cec37b8d88219ca7ec335941b387f552f`. Werkbranch: `codex/privacy-cost-controls`. Geen productieomgeving, echte persoonsgegevens of betaalde providerverzoeken gebruikt. SDK-transporttests onderscheppen alle fetch-aanroepen; browsers gebruiken een tijdelijk profiel en synthetische data.

## Gereproduceerde fouten

- **SEC-11 — quota na fallback:** een providerverzoek kon mislukken nadat de provider het al had aangenomen. De router gaf vervolgens een lokaal resultaat terug, waarna de gebruikersquota-reservering werd verwijderd. De nieuwe regressie zag vóór herstel nul verbruik na zo'n poging. Nu vermeldt de router of een externe poging is gestart; terugbetaling gebeurt uitsluitend bij aantoonbaar volledig lokale verwerking. Ook onzekere fouten tijdens RAG-queryherschrijving geven geen quota meer terug.
- **SEC-12 — late documentresultaten:** een lopende documentimport kon tekst en bestandsmetadata terugschrijven nadat de oorspronkelijke browsersessie was beëindigd. De twee regressies faalden vóór herstel. Asynchrone import, export, analyses en documentopslag zijn nu aan de oorspronkelijke accountsessie gebonden. Accountwissel en uitloggen trekken het signaal in; opnieuw inloggen als dezelfde gebruiker maakt een oude taak niet opnieuw geldig. Late resultaten worden geweigerd, analyses worden ook afgebroken bij vervangen/verlaten van de component. Dit bevestigt een onveilige client-state-update; er is geen werkelijk lek tussen productieaccounts waargenomen.

## Extra kosten- en privacygrenzen

| Instelling | Standaard | Werking |
| --- | --- | --- |
| `SERVER_AI_DAILY_CALL_LIMIT` | 500 | Gezamenlijk maximum van werkelijke server-key AI-pogingen per UTC-dag: gewone analyses, queryherschrijving en B2B samen. Iedere fallbackpoging telt apart. |
| `DISCOVERY_DAILY_CALL_LIMIT` | 1000 | Maximum nieuwe Google Discovery-zoekaanroepen per UTC-dag. Cachehits en gelijktijdig samengevoegde identieke queries tellen niet opnieuw. |
| `ORG_AI_DAILY_LIMIT` / `ORG_AI_GLOBAL_DAILY_LIMIT` | 100 / 500 | Bestaande aanvullende B2B-analysegrenzen blijven gelden. |

De nieuwe limieten staan in een gedeelde SQLite-tabel met een atomaire immediate-transactie; herstart en accountverwijdering resetten ze niet. De tabel bewaart alleen dienst, UTC-dag en aantal, maximaal zeven dagen historie plus de huidige dag. Nul, lege of ongeldige configuratie schakelt de betreffende externe dienst uit. Mislukte/afgebroken aanroepen worden niet terugbetaald. Een nieuwe limiet verhoogt geen bestaande gebruikers- of organisatiequota.

Dit zijn **aanroeplimieten, geen eurobudgetten**. Tokenprijs, invoerlengte, modelkeuze en reeds geaccepteerd providerwerk bepalen de rekening. Eigen gebruikerssleutels vallen buiten het gezamenlijke server-key-budget en vallen nooit terug op servercredentials. Ook voor eigen sleutels blijven uitvoerlimieten, geen SDK-retries, annulering en de bestaande gelijktijdigheidsgrens van toepassing. Zet harde bestedingslimieten waar beschikbaar bij iedere provider; een waarschuwingsmail alleen is geen betaalstop.

Cloudflare krijgt nu dezelfde maximale uitvoer van 4096 tokens (standaard 2400, kleinere routegrenzen blijven gelden). Alle vier SDK-providertransports weigeren redirects, voor server- en gebruikerssleutels. De echte SDK's zijn met een onderschepte fetch getest. Google Discovery gebruikt geen automatische retries, geen automatische paginering en geen ongebruikte generatieve samenvatting. Queryherschrijving krijgt ook de clientannulering mee.

Optionele PostHog-analytics laat uitsluitend expliciete paginaweergaven van vaste apppaden door. De verzendfilter verwijdert URL-parameters, fragmenten, referrers, titels, DOM-inhoud, persoonsvelden en onbekende eigenschappen. Automatische klikregistratie, replay, surveys, exception capture, heatmaps en performance capture staan expliciet uit. Zonder projectkey blijft analytics uit. Deze hardening is geen bewijs dat PostHog eerder echte lesinhoud heeft ontvangen; externe analytics kan bij gebruik nog steeds netwerkmetadata zoals het IP-adres ontvangen.

## Validatie

Gerichte tests gebruiken echte tijdelijke SQLite-databases, gesimuleerde providerantwoorden en vertraagde clienttaken. `node scripts/check-client-session.mjs` controleert daarnaast echte IndexedDB-transacties in een wegwerpbrowser: normale opslag, scheiding tussen accounts en weigering van late lees-/schrijfopdrachten na accountwissel of opnieuw inloggen. De volledige CI bouwt de app en herhaalt de bestaande HTTP-, Linux-isolatie-, browser- en backupherstelproeven. De concrete eindrun wordt na voltooiing hieronder vastgelegd.

## Volgende omgeving: VirtualBox, daarna DigitalOcean

1. Gebruik een bijgewerkte VirtualBox-installatie met een aparte Linux-gast die overeenkomt met het later gekozen server-OS. Geen gedeelde persoonlijke mappen, clipboard, drag-and-drop of USB-apparaten. Begin met synthetische data en een schone snapshot. Zie de [Oracle VirtualBox Security Guide](https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/Security.html).
2. Begin zonder echte providerkeys en zet beide nieuwe externe-aanroeplimieten op `0`. NAT voorkomt standaard inkomende toegang; NAT blokkeert niet alle uitgaande toegang tot de host of het thuisnetwerk. Gebruik voor offline/misbruikproeven een losgekoppelde netwerkadapter; geef alleen tijdelijk internettoegang voor vertrouwde installaties. Eventuele app-portforwarding uitsluitend op hostadres `127.0.0.1`.
3. Clone de repository in de gast. Bouw en test met dezelfde Node-versie als CI. Voer de stappen in [de deploymenthandleiding](digitalocean-first-deployment.md) uit, inclusief echte systemd-parserisolatie. De Linux-kernelproeven horen in de wegwerp-VM, niet rechtstreeks op de Windows-host.
4. Voeg later representatieve curriculumdata en documenten toe, draai `npm run check:corpora`, doorloop lesflows en meet geheugen, tijd, gelijktijdigheid, schijfgebruik en herstel. Gebruik voor een gecontroleerde providerproef aparte beperkte testkeys en lage providerbudgetten; controleer de werkelijk gefactureerde eenheden.
5. Herhaal de acceptatie op DigitalOcean, inclusief publiek HTTPS, firewall, forwardingheaders, monitoring en versleutelde offsite-backup met herstel op een tweede lege host. Een groene VirtualBox-proef bewijst niet dat de DigitalOcean-configuratie gelijk staat.
