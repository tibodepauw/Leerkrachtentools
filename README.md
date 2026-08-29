# Leerkrachtentools

Een modulaire Next.js-app voor Thomas More BALO-studenten. De app ondersteunt
lesdoelextractie en -verbetering, leerplandoelenkoppeling, Thomas More-formattering,
didactische controles en reflectie na de les.

## Lokaal starten

```bash
npm install
cp .env.example .env.local
npm run dev -- --hostname 0.0.0.0 --port 43127
```

AI-keys zijn optioneel voor de meeste modules. Zonder keys gebruikt de app lokale
demo-antwoorden — behalve **Doelverbeteraar** en **MC–DAS–SPM herkenner**:
daarvoor is een Google AI Studio-key verplicht.

```bash
GOOGLE_GENERATIVE_AI_API_KEY=jouw-key-van-aistudio.google.com
GOOGLE_MODEL=gemini-2.5-flash-lite
```

Overige providers (Groq, Cerebras, …) blijven optioneel als fallback.

E-mailauthenticatie werkt lokaal zonder Brevo-key met een zichtbare
ontwikkelcode. Voor productie zijn `AUTH_SECRET`, `BREVO_API_KEY` en een
`BREVO_FROM_EMAIL` op een geverifieerd Brevo-afzenderadres verplicht.

### Brevo instellen

1. Maak in Brevo een geverifieerd afzenderadres aan onder **Senders, domains, IPs**.
2. Zet in `.env.local`:

```bash
BREVO_API_KEY=jouw-api-key
BREVO_FROM_EMAIL=Leerkrachtentools <login@jouwdomein.be>
AUTH_SECRET=eentje-lange-willekeurige-string-minstens-32-tekens
```

3. Als **Block unauthorized IP addresses** actief is voor API-keys, voeg het publieke IP van je Oracle VM toe onder **Security → Authorized IPs**. Zonder die whitelist weigert Brevo verzending.

Verificatiecodes gaan via `POST https://api.brevo.com/v3/smtp/email` (transactionele API, geen SMTP-client nodig in de app).

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

Leerplandoelresultaten tonen bron, versie en schooljaar. Toekomstige leerplannen
staan los van de actieve index. Voeg nooit accountwachtwoorden of API-keys toe
aan de repository; gebruik uitsluitend `.env.local`.

### Officiële leerplan- en minimumdoelencorpus (RAG / GCS)

```bash
pip install -r scripts/requirements-curriculum.txt
python3 scripts/fetch_curriculum_data.py
```

Downloads landen in `data/{zill,go,ovsg,minimumdoelen}/` met JSON-sidecar-metadata.
Zie `docs/curriculum-bronnen-urls.md` voor alle officiële bron-URL's.
Optioneel: zet `ONDERWIJSDOELEN_API_KEY` voor JSON-export via de Onderwijsdoelen-API.

De marketingtoestemming staat standaard uit en kan na inloggen worden
ingetrokken. Controleer vóór publieke lancering ook het privacybeleid,
bewaartermijnen en de afmeldlink van toekomstige mailings.
