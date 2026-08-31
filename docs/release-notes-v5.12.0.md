# Leerkrachtentools v5.12.0

Wordmark branding, slim laadscherm, sidebar easter egg en public-repo security cleanup.

---

## Wordmark & laadscherm

- **Gather** is de standaard laadanimatie (Rubik Black wordmark)
- Instellingen → Laadscherm: kies variant of **Willekeurig** (andere animatie bij elke volledige laadbeurt)
- **Smart loading gate**: splash alleen bij eerste load/reload; snelle navigatie blijft direct
- Sidebar: compact wordmark logo; klik speelt een korte Gather-animatie af

## README & export

- Geanimeerde Gather-banner op GitHub (GIF + PNG fallback)
- Afgeronde hoeken ingebakken in banner assets (`npm run export:banner`)

## Overig

- Handleiding Scanner: zelfde bestandstypes als lesimport + afbeeldingen
- Module visibility via server env (geen admin UI)
- Loader-keuze blijft correct bewaard na reload

## Security

- Geen hardcoded secrets of persoonlijke admin-e-mails in de repo
- Agent instruction files (`AGENTS.md`, `CLAUDE.md`) uit repo en `.gitignore`

---

**Volledige changelog:** [CHANGELOG.md](https://github.com/tibodepauw/Leerkrachtentools/blob/main/CHANGELOG.md)
