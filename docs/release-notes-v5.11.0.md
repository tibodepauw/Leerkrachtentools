# Leerkrachtentools v5.11.0

Productie-optimalisaties en security-hardening: client-side RAG-cache, enterprise headers en SQLite-indexen.

---

## Client-side exact query cache

- `lib/rag/clientQueryCache.ts`: `sessionStorage`-cache met sleutel `${educationLevel}:${network}:${normalizedQuery}`
- Herhaalde exacte zoekopdracht in dezelfde tab: **0 server-aanroepen**
- Cache gewist bij logout, accountwissel; automatisch leeg bij tab-herladen
- Hook `useRagQueryAnalysis` in Leerplandoelen en Minimumdoelen

## Production security headers

- `X-Frame-Options: DENY` (productie)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: origin-when-cross-origin`
- `X-XSS-Protection: 1; mode=block`
- `Permissions-Policy: camera=(), microphone=(self), geolocation=()`

## SQLite index-optimalisatie

- `lib/db/ensureIndexes.ts`: composite index `sessions(user_id, created_at)`
- Extra indexen op `user_ai_usage` en `users.created_at`
- Actieve les en gepinde modules blijven client-side (localStorage)

---

**Volledige changelog:** [CHANGELOG.md](https://github.com/tibodepauw/Leerkrachtentools/blob/main/CHANGELOG.md)
