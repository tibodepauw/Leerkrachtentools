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

E-mailauthenticatie werkt lokaal zonder Resend-key met een zichtbare
ontwikkelcode. Voor productie zijn `AUTH_SECRET`, `RESEND_API_KEY` en een
`RESEND_FROM_EMAIL` op een geverifieerd domein verplicht.

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

Maak `data/` persistent en neem regelmatig een back-up van
`data/leerkrachtentools.db`. Deze SQLite-database bevat geverifieerde
e-mailadressen, optionele marketingtoestemming, gehashte login-codes en
gehashte sessies. Lesvoorbereidingen worden niet in deze database opgeslagen.

## Gegevens en bronnen

Curriculumresultaten tonen bron, versie en schooljaar. Toekomstige leerplannen
staan los van de actieve index. Voeg nooit accountwachtwoorden of API-keys toe
aan de repository; gebruik uitsluitend `.env.local`.

De marketingtoestemming staat standaard uit en kan na inloggen worden
ingetrokken. Controleer vóór publieke lancering ook het privacybeleid,
bewaartermijnen en de afmeldlink van toekomstige mailings.
