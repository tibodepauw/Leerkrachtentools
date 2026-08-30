# Leerkrachtentools v5.10.0

Release met volledige Vlaamse onderwijsdomeindekking, RAG-benchmark 10/10, Gemini 3.5 model-audit en optionele LLM Query Rewriting.

---

## Vlaanderen All Domains (v5.9.0)

- **OKAN, BuBaO, BuSO, DKO, volwassenen- en hoger onderwijs** via onderwijsdoelen.be (~24.571 doelen)
- Dynamische domeinfilters per niveau (NT2/integratie, BuBaO-types, BuSO OV1-3, DKO-graad, …)
- Python-fetch: `npm run fetch:all`, `npm run fetch:domains`
- Uniform JSONL-schema + GCS-export voor alle AHOVOKS-domeinen
- Gestroomlijnde secundaire scrape-pipeline (flat JSONL, `secondary_record_schema.py`)
- Leerplan-selectie schakelt automatisch naar AHOVOKS/ALL voor domeinniveaus

## AHOVOKS opschoning (v5.9.1)

- **Leerplandoelen**: enkel koepels (Op.stap, ZILL, KOV, GO!, OVSG, POV)
- **Minimumdoelen**: AHOVOKS-domeinen (OKAN, BuBaO, BuSO, …)
- Generieke toelichtingslabels (Ontwikkelingsdoelen, OV1, Type 2, …) verborgen in doelkaarten
- Fix lege Leerplan-select bij netwerk/niveau-mismatch

## RAG-benchmark 10/10 (v5.9.2 - v5.9.4)

- Benchmarksuite met 10 randgevallen: faithfulness, relevancy, latency, prompt-injectie
- **Inverted token-index** voor corpus-scan < 250 ms
- **ABSOLUTE_MIN_SCORE = 0.18** tegen ruis en zwakke matches
- Nederlandse getallen-normalizer + fonetische typos
- GO! legende-/meta-pagina's gefilterd uit corpus
- Disambiguatie: Engels, schrijfopstel, wiskundige `functie` vs. grammatica, programmeer-typos

## Gemini 3.5 model-audit & LLM Query Rewriting (v5.10.0)

- Centrale fallback: **`gemini-3.5-flash-lite`** (`GOOGLE_MODEL` env override)
- Alle Google AI-endpoints via `lib/ai/googleModel.ts`
- **Opt-in LLM Query Rewriting** in Instellingen: verrijkt vage zoekopdrachten via Gemini vóór RAG
- Standaard uit: snelle lokale Didactische Thesaurus blijft actief

## Secundair & UX (v5.8.13 - v5.8.17)

- Windows-compatibele `dist/secundair_update.zip` export
- Secundaire scraper-uitvoer niet meer op GitHub (security)
- Graad- en finaliteitsfilters secundair; leerjaren s1-s7 in Actieve les
- UI: sidebar 320px, resize/icoon-modus, minimumdoelen-terminologie

---

**Volledige changelog:** [CHANGELOG.md](https://github.com/tibodepauw/Leerkrachtentools/blob/main/CHANGELOG.md)
