# Leerkrachtentools - Overzicht AI & RAG

Dit document beschrijft wat de app doet op vlak van kunstmatige intelligentie (AI) en retrieval-augmented generation (RAG). Het is bedoeld als leesbare uitleg voor gebruikers, docenten en ontwikkelaars.

---

## 1. Wat doet de app in het kort?

Leerkrachtentools is een webapp voor Thomas More BALO-studenten (lager onderwijs). De app helpt bij het voorbereiden, controleren en reflecteren op lesvoorbereidingen. Daarbij worden twee soorten “slimme” technologie ingezet:

1. **AI (grote taalmodellen)** - voor analyse, herschrijven, classificatie, audit en reflectie.
2. **RAG-achtige retrieval (lokaal)** - voor het matchen van lesdoelen aan leerplandoelen en minimumdoelen, **zonder** een taalmodel.

Alle persoonlijke lesdata (lesvoorbereiding, doelen, geüploade documenten) blijft grotendeels **lokaal in de browser** (Zustand + IndexedDB). Alleen de tekst die je expliciet naar een module stuurt, gaat naar de AI-API op de server.

---

## 2. AI - architectuur

### 2.1 Hoe een AI-aanroep werkt

1. Je opent een module (bv. Doelverbeteraar of Taalfoutencheck).
2. Je plakt of uploadt lesvoorbereidingstekst.
3. De browser stuurt een POST-verzoek naar een API-route (bv. `/api/spellcheck`).
4. De server bouwt een **Nederlandstalige prompt** op en roept een **taalmodel** aan via de Vercel AI SDK.
5. Het model moet antwoord geven in een **vast JSON-schema** (gevalideerd met Zod).
6. Het resultaat verschijnt in het resultaatpaneel; je ziet ook welke provider gebruikt werd.

### 2.2 Ondersteunde AI-providers

De app kan werken met meerdere cloudproviders. Welke beschikbaar zijn, hangt af van serveromgevingsvariabelen of van **eigen API-keys** in Instellingen.

| Provider | Typisch gebruik |
|----------|-----------------|
| **Google Gemini** | Standaardkeuze; ook voor PDF, afbeeldingen en audio |
| **Groq** | Snelle Llama-modellen |
| **Cerebras** | Llama-variant |
| **SambaNova** | OpenAI-compatibel endpoint |
| **Cloudflare Workers AI** | Fallback via raw REST-aanroep |

**Eigen API-keys:** In Instellingen → API-keys kun je één provider kiezen, een model selecteren en je key opslaan (versleuteld in SQLite). Als eigen keys aan staan, gebruikt de app **alleen** die provider - geen automatische fallback naar serverkeys.

**Multimodal:** PDF’s, afbeeldingen (Handleiding Scanner) en audio (Voice-reflectie) gaan bij voorkeur via Google Gemini.

### 2.3 Fallback en betrouwbaarheid

- Meerdere providers kunnen na elkaar geprobeerd worden (serverkeys).
- Timeout per poging: ca. 45 seconden.
- Temperatuur: laag (0,2) voor consistente, feitelijke output.
- Zonder geconfigureerde provider: analyse-modules geven een **503-fout** - er zijn geen “nep-demo-antwoorden” meer in productie.

### 2.4 Structured output

Elke AI-taak heeft een **Zod-schema**. Het model moet JSON teruggeven dat aan dat schema voldoet, bv.:

- verbeterd doel + rationale
- lijst taalfouten met origineel/vervanging/reden
- stoplichtscore + criteria
- zes betrokkenheidsfactoren met bewijs en suggestie

Zo blijft de UI voorspelbaar en kan je resultaten kopiëren of terug naar Actieve les syncen.

---

## 3. AI-modules - wat doet welke functie?

### Input & doelen

| Module | API | Wat de AI doet |
|--------|-----|----------------|
| **Handleiding Scanner** | `/api/extract-manual` | Leest PDF/afbeelding/tekst en extraheert leergebied, onderdeel, onderwerp, doelgroep, materialen en ruwe uitgeverijdoelen. |
| **Doelverbeteraar** | `/api/analyze-goals` | Beoordeelt of een D-doel al voldoende is; zo niet, herschrijft volgens Thomas More-criteria (concreet, meetbaar, “De leerlingen kunnen…”). |
| **MC-DAS-SPM herkenner** | `/api/classify-goal-taxonomy` | Classificeert een doel als MC, DAS of SPM met uitleg - zonder het doel te herschrijven. |

### Lesvoorbereiding

| Module | API | Wat de AI doet |
|--------|-----|----------------|
| **Thomas More stijl** | `/api/format-dialogue` | Zet ruwe lesnotities om naar Lk:/Lln:-dialoog met cursieve stage-aanwijzingen. |
| **Taalfoutencheck** | `/api/spellcheck` | Controleert dt-fouten, formele instructietaal, didactische terminologie; levert verbeterde volledige tekst + alle gevonden issues. |
| **Timing** | `/api/audit-timing` | Geeft didactische suggesties voor fase-indeling (minuten worden **lokaal** uit tekst berekend; AI adviseert alleen). |

### Kwaliteitscontrole

| Module | API | Wat de AI doet |
|--------|-----|----------------|
| **Doel-activiteit** | `/api/audit-alignment` | Per D-doel: is instructie, verwerking en afronding gedekt, gedeeltelijk of afwezig? |
| **Betrokkenheid** | `/api/audit-engagement` | Analyseert zes Laevers-factoren (o.a. werkelijkheidsnabijheid, samen leren) met bewijs en suggestie. |
| **Totale audit** | `/api/full-audit` | Stoplichtscore (0-100%) op meerdere criteria (doelen, taal, timing, alignering, betrokkenheid, …). |

### Na de les

| Module | API | Wat de AI doet |
|--------|-----|----------------|
| **Voice-reflectie** | `/api/transcribe-reflection` | Verwerkt tekst + optionele audio-opname; vult Pagina 5 van het lesvoorbereidingsformulier in (doelgerichtheid D1-D3, betrokkenheid, leerkrachtidentiteit). Stelt max. 2 vervolgvragen (Fase B). |

### Geen AI

| Module | Techniek |
|--------|----------|
| **Actieve les** | Documentpreview (IndexedDB), Word-export (geüpload .docx patchen) |
| **Leerplandoelen / Minimumdoelen** | Lokale RAG-retrieval (zie §4) |
| **Import lesdocument** | Lokale tekstextractie (PDF, Word, …) |

---

## 4. RAG - leerplandoelen en minimumdoelen

### 4.1 Wat “RAG” hier betekent - en wat niet

In deze app is **curriculum matching geen klassieke LLM-RAG**:

- Er wordt **geen** taalmodel gebruikt om antwoorden te genereren op basis van opgehaalde documenten.
- Er is **geen** externe embedding-API (OpenAI, Cohere, …).
- Er is **geen** vector database (Pinecone, pgvector, …).

Wat wél gebeurt, is **retrieval**:

1. Een statische, handmatig ingevoerde **seed-corpus** met leerplandoelen en minimumdoelen.
2. **Lokale embeddings** (feature hashing → 384 dimensies, deterministisch).
3. **Cosinusgelijkenis** + keyword-overlap tussen jouw D-doel en corpusrecords.
4. Top 3 matches boven een drempel; anders: “niet gevonden”.

Dit is RAG in de brede zin (“eerst ophalen, dan tonen”), maar **zonder generatieve laag**.

### 4.2 Corpus - wat zit erin?

Het bestand `lib/rag/curriculumData.ts` bevat momenteel **18 seed-records**:

| Bron | Netwerk / type | Aantal (indicatief) |
|------|----------------|---------------------|
| Minimumdoelen | Vlaanderen (onderwijsdoelen.be) | 5 actief + 1 toekomst |
| Leerplandoelen | ZILL (Katholiek) | 4 |
| Leerplandoelen | OVSG | 3 + 1 toekomst |
| Leerplandoelen | GO | 3 + 1 toekomst |

**Belangrijk:** Dit is **geen volledige officiële index** van ZILL, OVSG, GO of onderwijsdoelen.be. Het zijn publiek verifieerbare voorbeelden om de retrieval-pijplijn te demonstreren. Records met status `future` worden **niet** getoond in zoekresultaten.

### 4.3 Zoeklogica

Filters bij zoeken:

- Alleen actieve records (`status: "active"`).
- Bron: `minimumdoel` of `leerplandoel`.
- Schooljaar (standaard 2025-2026).
- Bij leerplandoelen: gekozen netwerk (ZILL / OVSG / GO).

Score:

```
score = 0,75 × cosinus(embedding doel, embedding corpus) + 0,25 × keyword-overlap
```

API: `POST /api/rag-curriculum` - response bevat o.a. `retrievalMode: "indexed-only"` en `provider: "local"`.

### 4.4 UI-modules

| Module | Wat je ziet |
|--------|-------------|
| **Leerplandoelen** | Kies ZILL/OVSG/GO; voer D-doel in; krijg top matches met code, tekst, bron-URL. |
| **Minimumdoelen** | Zelfde flow voor Vlaamse minimumdoelen. |

### 4.5 Wat (nog) niet geïmplementeerd is

- Live koppeling met onderwijsdoelen.be API (`ONDERWIJSDOELEN_API_KEY` staat in `.env.example` maar wordt niet gebruikt).
- Automatische corpus-updates of volledige leerplan-import.
- Hybride RAG waarbij een LLM de opgehaalde doelen samenvat of toelicht.

---

## 5. Documentverwerking (niet-AI vs AI)

### 5.1 Lokale tekstextractie (geen AI)

Route: `/api/import-lesson-document`

- PDF → pdf-parse  
- DOCX → mammoth  
- DOC, ODT, RTF, TXT → gespecialiseerde parsers  

Gebruikt voor: lesvoorbereidingstekst in Actieve les, analysemodules, sync naar store.

### 5.2 AI-extractie (Handleiding Scanner)

Route: `/api/extract-manual`

- Multimodal: PDF/afbeelding + optioneel platte tekst.
- Output: gestructureerde JSON (leergebied, doelen, …).
- Doelen worden automatisch naar **Actieve les** gesynchroniseerd.

### 5.3 Word-export (geen AI)

Route: `/api/export-lesson-document`

- Past het **geüploade .docx-formulier** aan (LESDOEL 1/2/3, situering). Het Thomas More-sjabloon zit niet in de repo; upload je eigen formulier lokaal.
- Geen taalmodel betrokken.

---

## 6. Regels en lokale logica ( géén AI )

De app gebruikt ook **deterministische code** naast AI:

| Onderdeel | Functie |
|-----------|---------|
| `lib/timing.ts` | Minuten per fase uit tekst parsen; stoplicht voor timing in UI |
| `lib/goals/improveGoal.ts` | Fallback-regels voor doelverbetering (niet actief als AI verplicht is) |
| `lib/goals/classifyTaxonomy.ts` | Keyword-regex voor MC/DAS/SPM (fallback) |
| `lib/ai/dialogue.ts` | Validatie Thomas More Lk/Lln-formaat na AI-output |
| `lib/ui/trafficLight.ts` | “Grote afwijking” / “Lichte afwijking” i.p.v. rood/oranje |
| `lib/rag/vectorSearch.ts` | Volledige curriculum-zoekpipeline |
| Zustand + persist | Lesstate in browser |
| IndexedDB | Originele PDF/Word voor preview |

---

## 7. Privacy en datastromen

| Gegeven | Waar opgeslagen | Naar AI? |
|---------|-----------------|----------|
| Lesvoorbereidingstekst | Browser (Zustand) | Alleen wat je per analyse meestuurt |
| Geüpload PDF/Word | IndexedDB (lokaal) | Alleen bij Scanner/reflectie/export |
| Profiel, e-mail, API-keys | SQLite (server) | API-keys alleen naar gekozen provider |
| Curriculum corpus | Statisch in code | Nooit naar externe AI |

Prompts instrueren expliciet: **verzin geen officiële leerplandoelcodes**; bij onzekerheid liever “niet gevonden” dan hallucinatie.

---

## 8. Samenvattend schema

```
┌─────────────────────────────────────────────────────────────┐
│                        GEBRUIKER                            │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   AI-modules          RAG-modules        Actieve les
   (LLM analyse)    (lokaal retrieval)   (preview/export)
        │                   │                   │
        ▼                   ▼                   ▼
   /api/spellcheck    /api/rag-curriculum   import/export
   /api/analyze-goals      │                   │
   /api/full-audit         ▼                   │
        │            vectorSearch +            │
        ▼            curriculumData            │
   runStructured ──► Google/Groq/…            │
   (Zod schema)                               │
        │                                     │
        └──────── JSON resultaat ◄────────────┘
                  naar UI
```

---

## 9. Roadmap-implicaties (huidige beperkingen)

1. **RAG-corpus is demo-seed** - geen volledige leerplanindex.  
2. **Alle analyse vereist AI-keys** - zonder provider geen analyse.  
3. **Word-export** vereist een geüpload .docx-formulier; PDF-bestanden worden niet geëxporteerd.  
4. **Voice-reflectie** gebruikt het LLM voor “transcriptie” van audio, geen aparte Whisper-service.  
5. **Geen fine-tuning** - alles via prompting + structured output op commerciële modellen.

---

*Document gegenereerd op basis van de codebase van Leerkrachtentools. Laatste relevante wijzigingen: Word-export via formulier-patch, paginascroll in modules, sync lesvoorbereidingstekst uit Actieve les.*
