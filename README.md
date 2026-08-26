# Leerkrachtentools

Een modulaire Next.js-app voor Thomas More BALO-studenten. De app ondersteunt
lesdoelextractie en -verbetering, curriculum-RAG, Thomas More-formattering,
didactische controles en reflectie na de les.

## Lokaal starten

```bash
npm install
cp .env.example .env.local
npm run dev -- --hostname 0.0.0.0 --port 43127
```

AI-keys zijn optioneel. Zonder keys gebruikt de applicatie lokale,
deterministische demo-antwoorden en de ingebouwde curriculumseed.

## Kwaliteitscontrole

```bash
npm run lint
npm run typecheck
npm run build
```

## Oracle VM

De productiebuild gebruikt Next.js `output: "standalone"`:

```bash
npm run build
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

Kopieer voor een losse deployment ook `.next/static` en `public` naar de
overeenkomstige locaties onder `.next/standalone`.

## Gegevens en bronnen

Curriculumresultaten tonen bron, versie en schooljaar. Toekomstige leerplannen
staan los van de actieve index. Voeg nooit accountwachtwoorden of API-keys toe
aan de repository; gebruik uitsluitend `.env.local`.
