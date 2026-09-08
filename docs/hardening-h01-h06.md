# Hardening tickets H-01 tot H-06

Deze tickets blijven aparte product- en operationskeuzes. Ze zijn geen bewezen exploits uit de v5.20.0-vervolgaudit.

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
