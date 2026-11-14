# Officiële leerplanbronnen

Bronroutes opnieuw onderzocht op 11 november 2026. Dit overzicht beschrijft toegangen, geen bewijs van volledige dekking. De werkelijke lokale status en foutredenen staan in `data/corpus/manifest.json`. Gebruik de [handleiding voor handmatige vernieuwing](curriculum-handmatig-vernieuwen.md). Er zijn geen automatische controles ingepland.

| Bron | Officiële ingang | Werkwijze en beperkingen |
| --- | --- | --- |
| GO! nieuw basisonderwijs | [Nieuw leerplan](https://pro.g-o.be/themas/leerplannen/basisonderwijs/nieuw-leerplan-basisonderwijs/) | Twaalf Excel-doelensets en afzonderlijke visie-PDF's. Bronstatus en editie bewaren; goedkeuring niet veronderstellen. |
| GO! oud basisonderwijs | [Oude vakleerplannen](https://pro.g-o.be/themas/leerplannen/basisonderwijs/oud-leerplan-basisonderwijs/) | Acht vakpagina's via dit overzicht ontdekken. Oudere routes zonder het segment `oud-leerplan-basisonderwijs` niet construeren. Hoofdleerplannen onderscheiden van algemene delen en bijlagen. |
| ZILL | [Publieke selector](https://zill.katholiekonderwijs.vlaanderen/) | Publieke gerenderde veld-, thema- en doelpagina's. Alternatieve AN- en BuBaO-weergaven afzonderlijk valideren. |
| Op.stap | [Actuele leerplantool](https://opstap.katholiekonderwijs.vlaanderen/) | De bekende `cached-api`-route sluit automatisch ophalen uit. Geen oude snapshot of Excel-export als actuele versie gebruiken. Een toegestane bulkexport is nodig. |
| OVSG basisonderwijs | [Leerplan Leer Lokaal](https://leerlokaal.ovsg.be/bao/leerplan) | Editie 2027-2028 op 13 november ingelogd verzameld: 9 leergebieden, 129 leerlijnen, 3937 centrale doelen met ondersteuning, verdieping en relaties. Afzonderlijke handmatige accountworkflow via `fetch:ovsg`. Het aparte [updateportaal](https://leerlokaalupdate.ovsg.be/) voor 2026-2027 accepteert het geteste account niet. |
| Onderwijsdoelen | [Officieel portaal](https://www.onderwijsdoelen.be/) | Actuele publieke clientconfiguratie verwijst naar de gecontroleerde [Onderwijsdoelen-API](https://onderwijs.api.vlaanderen.be/onderwijsdoelen). Alle pagina's en geldigheid bewaren; onbekende geldigheid niet als actueel aannemen. Geen scraping van het door robots uitgesloten `/resultaten`-pad. |
| GO! secundair | [Leerplannenoverzicht](https://pro.g-o.be/themas/leerplannen/) | Publieke PDF's per graad, stroom en finaliteit. Volledige documentinventaris controleren. |
| KOV secundair | [Vakken en leerplannen](https://pro.katholiekonderwijs.vlaanderen/vakken-en-leerplannen?tab=eerstegraad) | Werkelijk gelinkte vak- en leerplanpagina's volgen. Een vak-URL plus `/leerplan` construeren werkt niet betrouwbaar. Word waar beschikbaar en PDF-only vakken onderscheiden. Aangeboden edities behouden. |
| OVSG secundair | [Ingelogde eerste-graadleerplannen](https://leerlokaal.ovsg.be/so/leerplannen) en [publieke leerplanzoeker](https://www.ovsg.be/leerplannen-secundair-onderwijs) | Alle vijf aangeboden accountleerplannen van broneditie 2025 verzameld: 4341 centrale doelen, 320 leerlijnen en 53 indelingen. Afzonderlijke handmatige ingang `fetch:ovsg-secundair`. De publieke PDF/Word-inventaris en andere graden behouden hun afzonderlijke brongrenzen. |
| POV secundair | [Doelenverdeler-documentatie](https://pov.classid.io/website/sapo-endpoints) | Officiële API met sleutel via het registratieformulier. `POV_API_KEY` blijft lokaal en gaat alleen in de `api-key`-header naar `classid.io`. |

De onderwijsdoelenverzameling wordt verdeeld over basisonderwijs, secundair, OKAN, BuBaO, BuSO, DKO, volwassenenonderwijs en hoger onderwijs. Een gelijk doelnummer kan in verschillende sets of bijlagen voorkomen. Bewaar de volledige bronidentiteit, doelenset, titelcontext en geldigheidsdatums.

De oudere individuele fetchscripts bestaan nog voor compatibiliteit en formaatonderzoek. Hun vaste momentopnames en aantallen zijn geen actuele broninventaris. De normale onderhoudsingang is `npm run fetch:all` na een expliciete `npm run corpus:setup`.
