# Hardening tickets H-01 tot H-06

Update 18 september, tweede herstelronde: procesisolatie voor document/beeldverwerking, harde stop voor de drie productie-B2B-routes en echte organisatie-AI-dagbudgetten zijn toegevoegd op `codex/security-audit`. Zie [actueel auditrapport](security-audit-2026-09-18.md). Eerdere openstaande-codebeschrijvingen hieronder zijn historisch; Linux/VM-acceptatie wordt afzonderlijk bijgehouden.

Update 18 september 2026: de aangevraagde repositoryaudit is uitgevoerd op `codex/security-audit`. Zie [bevindingen, herstel en resterende productievoorwaarden](security-audit-2026-09-18.md). Browserproeven voor opslagwissen, offline/online, terugkeer, accountwissel en logout in twee tabbladen slagen. De aanvullende fixes en tests wachten op review/Linux-CI; VM-isolatie en operationele acceptatie blijven open. Onderstaande tabel beschrijft de eerdere voorbereidingsronde.

De onderstaande oorspronkelijke tickets zijn op 17 september 2026 verder uitgewerkt op `codex/production-preparation`. Dit is geen volledige securityaudit en geen deployment. De eigenaar bevestigt dat er nog geen productieomgeving live staat.

| Ticket | Uitgewerkt in code | Nog te verifiëren of uit te voeren |
| --- | --- | --- |
| H-01 | Expliciete gedeelde-computerkeuze bij login; lessen en previews in tabgeheugen; eerdere scoped opslag wordt bij activatie gewist; logout wist geheugen | Browseracceptatie voor terugknop, crash/heropenen, opslagblokkering en twee accounts |
| H-02 | BroadcastChannel + storage-events; sessiecheck bij focus/pageshow; inhoud verborgen tijdens revalidatie; logout faalt zichtbaar bij serverfout | Volledige interactietest met meerdere browservensters, offline/online en accountwissel |
| H-03 | PDF/DOC in aparte processen; 8 seconden deadline met harde processtop; maximaal twee processen; JS-heapgrens; geen appsecrets in parseromgeving | Linux-staging, grotere corpus-/documentbelasting, per-job native geheugenlimiet en verdere OS-sandboxing |
| H-04 | Volledig decoderen; 16 miljoen pixels, 8192 per zijde; geen animatie; WebP maximaal 512px; metadata strippen; tijdelijk bestand en rename; no-store | Routeacceptatie op Linux met een verzameling echte afbeeldingen |
| H-05 | Nieuwe sleutels standaard 90 dagen (max. 365); expliciete scopes in CLI; uitgifte aan bestaande org; atomaire rotatie/intrekking; auditmetadata zonder token; ingetrokken cache-replay getest | Operationele rotatieplanning en beheer van reeds uitgegeven sleutels |
| H-06 | Actions op SHA; CI-timeout/concurrency; Dependabot; standalone smoke-test; nginx/systemd-templates; consistente SQLite-backup met integriteitscheck | Branch/tagbescherming door eigenaar; templates activeren en toetsen op VM; providerbudgetten, externe alarmen, offsite-backups en volledige hersteltest |

De oorspronkelijke beschrijvingen hieronder zijn historische context. De tabel is de actuele opvolgstatus. V20-08 is slechts gedeeltelijk aangepakt: cancellation gaat nu door de B2B-routes en Cloudflare; actieve verwerking vernieuwt haar lease. Een harde stop voor willekeurige B2B-handlercode is nog open. PDF/DOC-procesisolatie sluit dat afzonderlijke ticket niet.

## H-01 Gedeeld-apparaatmodus

Uitloggen wist in-memory state, niet alle per-user localStorage- en IndexedDB-records. Accountverwijdering wist gerichte browserdata wel.

Voorgesteld werk: expliciete gedeeld-apparaatmodus, wissen of niet-persistente lesinhoud bij logout, UI-tekst over lokale opslag. Test terugknop, heropenen, crash en accountwissel. Bewaartermijnen zijn productbeleid.

## H-02 Logout over tabbladen

Logout/reset werkt in het eigen tabblad. Voeg BroadcastChannel of storage-events toe met sessioninvalidatie en revalidatie bij focus. Test A in twee tabs, logout of login B in één tab: de andere tab mag geen A-inhoud onder B's cookie houden.

## H-03 PDF/DOC-parserisolatie

ZIP-inflate is begrensd. PDF- en DOC-parsing lopen nog in het serverpad; de tekstlengtecheck volgt na extractie. Onderzoek workerisolatie en harde geheugen-, CPU- en tijdlimieten per job. Test malforme documenten in een geïsoleerde runner. Forceer geen OOM op productie.

## H-04 Avatar hercoderen

De avatarroute heeft een requestlimiet en signaturecheck, maar decodeert en hercodeert niet volledig. Voeg dimensie- en pixellimieten, metadata-strip en canonieke output toe. Dit is defense-in-depth, geen bewezen avatar-XSS.

## H-05 B2B-sleutellevenscyclus

Validatie ondersteunt verval en intrekking. Nieuwe keys krijgen standaard geen vervaldatum. Definieer rotatie, beperkte scopes, eenmalige uitgifte, audittrail en incidentintrekking. Test dat cache-replay intrekking niet omzeilt.

## H-06 Releasechecks en operationele limieten

CI heeft al least-privilege, OSV, typegen, lint, typecheck, test en build. Openstaand: Actions pinnen op commit-SHA's, dev/build-dependencybeleid, beschermde release-tags, edge-rate-limits, body/read-timeouts, procesgrenzen, providerbudgetten, logalarmen en backup/hersteltests. Het globale OTP-noodplafond van 2.000 per 15 minuten kan bij uitputting alle gebruikers raken.
