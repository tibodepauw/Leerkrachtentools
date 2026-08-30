# Leerkrachtentools v5.10.4

Release met lazy loading van RAG-corpora (Oracle VM / 1 GB-vriendelijk), secundaire klimaat-minimumdoelen-fixes en sidebar-/filter-verbeteringen.

---

## Lazy loading RAG-corpora (v5.10.4)

- **`getCorpusForLevel(level)`** laadt on-demand per onderwijsniveau:
  - **Basisonderwijs** (KLEUTER/LAGER): `opstap`, `zill`, `ovsg`, `go_nieuw`
  - **Secundair**: `data/secundair/`
  - **Domeinen** (OKAN, BuBaO, BuSO, DKO, …): enkel het betreffende JSONL-bestand
- Maximaal **2 actieve niveau-caches** in RAM; automatische **unload na 5 min** inactiviteit
- Token-indexen per niveau; geen volledige corpus-load meer bij server-start (~577 MB op schijf → enkel actief niveau in geheugen)

## Secundaire minimumdoelen & RAG (v5.10.1 - v5.10.3)

- Fix **klimaat/broeikaseffect/fossiele brandstoffen** in secundair: indexeer `gelinkt_minimumdoel`-tekst in haystack
- OR-candidate retrieval voor multi-keyword queries (pool 30)
- `scoreClimateMinimumGoalBonus()` voor SC6/SC9-doelen
- Benchmark **10/10** behouden; responstijd-drempel verlaagd naar 350 ms

## UI & filters (v5.10.2 - v5.10.3)

- **Onderwijsniveau** blijft behouden bij wissel tussen Minimumdoelen ↔ Leerplandoelen
- Persistente `curriculumNetworkFilter` in lesson store
- **Sidebar**: uitvouwen-icoon (`PanelLeftOpen`) ingeklapt, invouwen-icoon (`PanelLeftClose`) uitgeklapt
- Gecentreerde nav-iconen zonder scrollbar-offset in ingeklapte modus
- Netwerkfout: kortere melding zonder stageschool-wifi-copy

---

**Volledige changelog:** [CHANGELOG.md](https://github.com/tibodepauw/Leerkrachtentools/blob/main/CHANGELOG.md)
