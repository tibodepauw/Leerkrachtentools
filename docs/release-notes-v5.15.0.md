# Leerkrachtentools v5.15.0

Productiebeveiliging, betrouwbaardere curriculumzoekacties en een rustigere interface.

---

## Beveiliging

- API-keys zijn versleuteld gebonden aan de gebruiker en gekozen provider
- Beschadigde eigen credentials vallen nooit terug op serverkeys
- API-, AI-, RAG- en documentroutes hebben request- en concurrencylimieten
- CSP gebruikt unieke request-nonces; HSTS, framing- en same-originbescherming zijn actief
- Sessies zijn korter geldig en een nieuwe login trekt oudere sessies in
- Accountverwijdering wist ook lokale lesdata en documentopslag
- Uploads controleren inhoudssignaturen, grootte en uitgepakte archiefomvang
- Productiedependencies worden in CI rechtstreeks tegen OSV gecontroleerd

## AI en RAG

- Serverfallback probeert maximaal twee providers binnen één globale deadline
- Mislukte betaalde providerpogingen blijven meetellen tegen misbruik
- Identieke Discovery Engine-zoekacties worden kort gecachet en samengevoegd
- ALL-level zoekopdrachten, GO/GO Nieuw en secundaire minimumdoelen zijn gecorrigeerd
- Modeldetectie verstuurt Google API-keys niet langer in de URL

## Documenten en privacy

- De uploadlimiet is 8 MB
- DOCX- en ODT-archiefbommen worden vóór extractie geweigerd
- Scannerresultaten worden eerst getoond ter controle
- Overnemen naar Actieve les gebeurt pas na een expliciete klik
- Oude browseropslag kan niet meer tussen verschillende gebruikers worden gekopieerd

## Interface

- Instellingen opent zonder accountopslag opnieuw te laden
- Pins verschijnen alleen bij hover met Nederlandse uitleg
- Overbodige helpertekst, dubbele meldingen en scheidingslijnen zijn verwijderd
- Curriculumzoekacties tonen een rustige, vertraagde laadstatus
- API-key- en accountstatuscopy is consistenter

## Kwaliteit

- 269 geautomatiseerde tests in 61 testbestanden
- Productiebuild, typecheck en lint zonder fouten
- Geen bekende kwetsbaarheden in de 278 productiepackages tijdens de releasecontrole

---

**Volledige changelog:** [CHANGELOG.md](https://github.com/tibodepauw/Leerkrachtentools/blob/main/CHANGELOG.md)
