# Dependency-PR review — 18 september 2026

## Uitgangspunt

Beoordeeld na merge van PR #12, op `main` commit
`85a0a1260c2a83c6422f837572579fa9957edd8b`. De CI van die commit is
[geslaagd](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/35392796036).
Dit is een beoordeling van de zeven open dependency-PR's en een kleine
correctie aan dependency-onderhoud; geen nieuwe productieacceptatie.

## Resultaat per PR

| PR | Bevinding | Vervolg |
| --- | --- | --- |
| [#4](https://github.com/tibodepauw/Leerkrachtentools/pull/4), setup-node 7 | Alleen de vastgezette action-commit verandert. Node 22 en npm-cache blijven gelijk. Volledige CI geslaagd op head `72621ca`, gebaseerd op de nieuwe main. | Geschikt om via de gewone beschermde merge te verwerken. Na andere merges opnieuw actueel maken en groene checks afwachten. |
| [#5](https://github.com/tibodepauw/Leerkrachtentools/pull/5), checkout 7 | Alleen de vastgezette action-commit verandert. `persist-credentials: false`, minimale workflowrechten en gewone `pull_request`-trigger blijven behouden. Volledige CI geslaagd op head `41aa982`, gebaseerd op de nieuwe main. | Geschikt om via de gewone beschermde merge te verwerken; na elke merge actualiseren en opnieuw controleren. |
| [#6](https://github.com/tibodepauw/Leerkrachtentools/pull/6), Vitest 5 | `npm ci` faalt met ERESOLVE: Vitest 5.0.1 vereist optionele Node-types `^22.0.0 || >=24.0.0`, terwijl het project `^20` had. De tests zijn in deze PR-run niet gestart. | Deze onderhoudsbranch corrigeert de Node-types naar 22. Daarna PR actualiseren, migratie controleren en alle tests opnieuw draaien. Vitest 5 is hiermee nog niet goedgekeurd. |
| [#7](https://github.com/tibodepauw/Leerkrachtentools/pull/7), PostHog | De groene run is van vóór de aanvullende privacyfixes in PR #12. Een nieuwe SDK-versie moet met de huidige eventfiltering en uitgeschakelde automatische verzameling worden gecontroleerd. | Eerst bijwerken naar de nieuwste main; typecheck, privacytests en browsergedrag beoordelen. Nog geen mergeadvies op basis van de oude groene run. |
| [#8](https://github.com/tibodepauw/Leerkrachtentools/pull/8), Google AI-provider 4 | Typecheck faalt op `LanguageModelV4`, dat niet past bij het huidige `LanguageModel` van AI SDK 6. | Samen met de core-SDK en betrokken providers migreren. Geen losse merge. |
| [#9](https://github.com/tibodepauw/Leerkrachtentools/pull/9), AI SDK 7 | De oude CI-run is groen, maar test niet de nieuwste transport-, annulering- en kostencontroles uit PR #12. | Gezamenlijke AI-migratie met #8 en providercompatibiliteitscontrole; opnieuw de volledige huidige controles uitvoeren. |
| [#10](https://github.com/tibodepauw/Leerkrachtentools/pull/10), Node-types 26 | Compileert in de oude CI, maar beschrijft een nieuwere runtime dan Node 22 in CI en de ondersteunde installatiebasis. Dit kan gebruik van niet-beschikbare API's verhullen. | Vervangen door de Node 22-types in deze onderhoudsbranch. Na merge daarvan kan #10 worden gesloten. |

Gecontroleerde action-runs:
[setup-node](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/35392979208)
en [checkout](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/35392975550).
Faaldiagnoses komen uit de joblogs van
[Vitest](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/35385077911)
en [Google AI](https://github.com/tibodepauw/Leerkrachtentools/actions/runs/35385110945).
Deze status is een momentopname; nieuwere commits moeten opnieuw worden gecontroleerd.

## Correctie in deze branch

- `@types/node` van `^20` naar `^22`, lockversie `22.20.3`, passend bij de
  laagste ondersteunde runtime. Geen wijziging van de geïnstalleerde Node-runtime.
- Dependabot groepeert `ai` en `@ai-sdk/*` voor gezamenlijke versie-updates.
  Groepering helpt compatibiliteit beoordelen, maar garandeert die niet.
- Automatische major-updates van `@types/node` worden uitgesteld tot een
  bewuste runtime-upgrade. Updates binnen 22 blijven aangeboden. Bij het
  verhogen van de laagste Node-runtime moet ook deze keuze worden herzien.
- Geen runtimepakket, betaalde dienst, API-sleutel of productieconfiguratie gewijzigd.

## Lokale validatie

Uitgevoerd op Windows, Node 24.19.0, met de gewijzigde Node 22-types:

- TypeScript `--noEmit`: geslaagd.
- ESLint: nul fouten en nul waarschuwingen.
- Volledige bestaande Vitest 4-suite: **601 geslaagd, 0 mislukt, 1 overgeslagen**
  wegens ontbrekende curriculumdata. Vitest 5 is niet geïnstalleerd of getest.
- OSV-controle van alle **968 productie- en buildpakketten**: geen bekende
  kwetsbaarheden gevonden op het controlemoment.
- Dependabot-YAML succesvol geparseerd; gegenereerd lockbestand gecontroleerd.

De PR van deze branch moet daarnaast de volledige GitHub-CI op Linux doorlopen
voor de merge. Er zijn in deze ronde geen nieuwe VM-, provider- of browserproeven
uitgevoerd. Bestaande Dependabot-PR's zijn niet gemerged of gesloten.

## Referenties

- [GitHub Dependabot-opties](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
- [checkout 7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1)
- [setup-node 7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0)
- [Vitest-migratiegids](https://main.vitest.dev/guide/migration/)
