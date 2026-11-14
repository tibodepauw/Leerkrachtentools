# Documentatie

Stand: **14 november 2026**. De actuele codeversie is **v5.21.0-rc.2**.
Deze releasekandidaat bevat de gemergede audits en curriculumwijzigingen tot en
met #44. De [app-CI](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/43617036299)
en de lokale productieacceptatie slagen. Er is nog geen DigitalOcean-server
of livegang ingericht. Echte providerconfiguratie en ontbrekende bronbestanden
blijven afzonderlijke voorwaarden.

[Release v5.21.0-rc.2](releases/v5.21.0-rc.2.md) beschrijft de actuele validatie.
[Privacybeheer](privacy-operations.md) beschrijft toestemming, export, opruiming
en de nog onbekende productiefeiten.

## Actuele handleidingen

| Document | Gebruik |
| --- | --- |
| [Privacybeheer](privacy-operations.md) | Toestemming, export, opruiming en onbekende productiefeiten |
| [Leerplanbronnen handmatig vernieuwen](curriculum-handmatig-vernieuwen.md) | Bronkopieën, catalogus, actualiteit, toegang en herstel zonder automatische planning |
| [README](../README.md) | Functies, lokale start, B2B-overzicht en configuratie |
| [AI en RAG](AI-en-RAG-overzicht.md) | Huidige architectuur, opslag en externe datastromen |
| [Eerste DigitalOcean-installatie](digitalocean-first-deployment.md) | Nieuwe VM, parserisolatie, corpora, kostenlimieten en herstel |
| [Release v5.21.0-rc.2](releases/v5.21.0-rc.2.md) | Actuele releasekandidaat, bewijs en acceptatievoorwaarden |
| [Changelog](../CHANGELOG.md) | Versiegeschiedenis en nog niet uitgebrachte wijzigingen |
| [Contributing](../CONTRIBUTING.md) | Ontwikkelomgeving en vereiste controles |
| [Security policy](../SECURITY.md) | Beveiligingsbaseline en kwetsbaarheden melden |

De pre-release is bedoeld voor staging- en VM-tests. Volledige curriculumcorpora,
echte provideraccounts en budgetten, VM-belasting, HTTPS/firewall, monitoring en
offsite-herstel blijven vóór productie te controleren. Die controles kunnen niet
worden vervangen door een groene repository-CI.

## Auditgeschiedenis

Auditrapporten beschrijven de code en proeven op hun vermelde datum en commits.
Bewaar die meetresultaten als historisch bewijs: oude aantallen tests of een
destijds open ticket zijn geen actuele takenlijst. De drie onderstaande historische rondes
zijn opgenomen sinds v5.21.0-rc.1:

| Rapport | Scope |
| --- | --- |
| [Aanvullende cloudaudit 30 september](cloud-security-audit-2026-09-30.md) | Dependency-advisories, nieuwe races/limits, synthetische isolatie/kosten/herstel en actuele testbewijzen; kernelacceptatie geblokkeerd |
| [Securityaudit 18 september](security-audit-2026-09-18.md) | Documentisolatie, auth, quota, Linux-grenzen, browsers en restore; gemerged via PR #11 |
| [Privacy en API-kosten](privacy-cost-review-2026-09-18.md) | Sessiewissels, caches en gedeelde kostenplafonds; gemerged via PR #12 |
| [Dependency- en privacyvalidatie](dependency-security-validation-2026-09-19.md) | SDK-responsegrenzen, analyticsopslag en dependency-upgrades; gemerged via PR #19 |

Eerdere voorbereiding: [17 september](production-preparation-review.md),
[H-01–H-06](hardening-h01-h06.md), [v5.20-follow-up](audit-v20-followup.md),
[D1-eindcontrole](EINDCONTROLE_D1_2026-09-09.md) en
[dependencyreview](dependency-review-2026-09-18.md).
De [v5.20-cutover](production-cutover-v20.md) is alleen voor een bestaande oude
database; voer die backfill niet uit op een nieuwe installatie.

## Curriculumbronnen en overige referenties

- [Bronnen en URLs](curriculum-bronnen-urls.md) en
  [onderwijsdomeinen](onderwijsdoelen-volledig-overzicht.md) bevatten brononderzoek.
  Aantallen of bronbeschikbaarheid uit dat onderzoek bewijzen niet dat de komende
  installatie volledige, actuele corpora heeft; controleer die na aanlevering.
- `release-notes-v*.md` zijn historische releasebeschrijvingen.
- [Laadschermconcepten](loading-screen-concepts.md) zijn ontwerpvoorstellen.
