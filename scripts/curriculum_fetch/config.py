from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = REPO_ROOT / "data"

NETWORKS = ("ZILL", "GO", "OVSG", "MINIMUMDOELEN")
DEFAULT_ONDERWIJDSNIVEAU = "lager onderwijs"

USER_AGENT = (
    "Leerkrachtentools-curriculum-fetch/1.0 "
    "(education corpus; contact: local-dev)"
)

# Officiële overzichts- en downloadpagina's (geen nieuwe GO-leerplannen).
OFFICIAL_OVERVIEW_URLS: dict[str, list[dict[str, str]]] = {
    "ZILL": [
        {
            "titel": "ZILL — publieke startpagina",
            "url": "https://zill.katholiekonderwijs.vlaanderen/",
            "opmerking": "Digitaal leerplan; aanvullende PDF's via Pro.",
        },
        {
            "titel": "ZILL — ordeningskader & downloadhub",
            "url": "https://pro.katholiekonderwijs.vlaanderen/achtergrond-bij-ontwikkelvelden/het-ordeningskader",
            "opmerking": "Publieke PDF-bijlagen (ordeningskader, generieke doelen, leerplanpuzzel).",
        },
    ],
    "GO": [
        {
            "titel": "GO! — Leerplan Basisonderwijs (overzicht)",
            "url": "https://pro.g-o.be/themas/leerplannen/basisonderwijs/",
            "opmerking": "Huidige vakgebieden; excludeert bewust het concept 'nieuw leerplan'.",
        },
        {
            "titel": "GO! — Algemeen deel leerplan",
            "url": "https://pro.g-o.be/themas/leerplannen/basisonderwijs/algemeen/",
        },
        {
            "titel": "GO! — Media",
            "url": "https://pro.g-o.be/themas/leerplannen/basisonderwijs/media/",
        },
        {
            "titel": "GO! — Lichamelijke opvoeding",
            "url": "https://pro.g-o.be/themas/leerplannen/basisonderwijs/lichamelijke-opvoeding/",
        },
        {
            "titel": "GO! — Nederlands",
            "url": "https://pro.g-o.be/themas/leerplannen/basisonderwijs/nederlands/",
        },
        {
            "titel": "GO! — Wiskunde",
            "url": "https://pro.g-o.be/themas/leerplannen/basisonderwijs/wiskunde/",
        },
        {
            "titel": "GO! — Wereldoriëntatie",
            "url": "https://pro.g-o.be/themas/leerplannen/basisonderwijs/wereldorientatie/",
        },
        {
            "titel": "GO! — Muzische vorming",
            "url": "https://pro.g-o.be/themas/leerplannen/basisonderwijs/muzische-vorming/",
        },
        {
            "titel": "GO! — Frans",
            "url": "https://pro.g-o.be/themas/leerplannen/basisonderwijs/frans/",
        },
    ],
    "OVSG": [
        {
            "titel": "OVSG — Leer Lokaal (overzicht basisonderwijs)",
            "url": "https://www.ovsg.be/onze-themas/leerplannen-didactiek/basisonderwijs/leer-lokaal/",
        },
        {
            "titel": "OVSG — Leerplan Leer Lokaal",
            "url": "https://www.ovsg.be/onze-themas/leerplannen-didactiek/basisonderwijs/leer-lokaal/leerplan-leer-lokaal",
            "opmerking": "Volledig leerplan vereist OVSG-login (leerlokaal.ovsg.be).",
        },
        {
            "titel": "OVSG — Leergebieden, leerlijnen & visieteksten",
            "url": "https://www.ovsg.be/onze-themas/leerplannen-didactiek/basisonderwijs/leer-lokaal/leergebieden-leerlijnen-leerlokaal",
            "opmerking": "Publieke visie-PDF's per leergebied.",
        },
        {
            "titel": "OVSG — FAQ Leer Lokaal",
            "url": "https://www.ovsg.be/onze-themas/leerplannen-didactiek/basisonderwijs/leer-lokaal/faq-leer-lokaal",
        },
        {
            "titel": "OVSG — Leer Lokaal (ledenportaal)",
            "url": "https://leerlokaal.ovsg.be/",
            "opmerking": "Login vereist; niet automatisch te scrapen.",
        },
    ],
    "MINIMUMDOELEN": [
        {
            "titel": "Onderwijsdoelen.be — zoekportaal",
            "url": "https://www.onderwijsdoelen.be/",
        },
        {
            "titel": "Vlaanderen.be — Onderwijsdoelen (professionals)",
            "url": "https://www.vlaanderen.be/onderwijsprofessionals/lesgeven-en-begeleiden/opleidingsinhouden/onderwijsdoelen",
        },
        {
            "titel": "Vlaanderen.be — Nieuwe minimumdoelen basisonderwijs",
            "url": "https://www.vlaanderen.be/onderwijsprofessionals/lesgeven-en-begeleiden/opleidingsinhouden/opleidingsinhouden-basisonderwijs/nieuwe-minimumdoelen-basisonderwijs",
            "opmerking": "Flyers, brochures en implementatiemateriaal.",
        },
        {
            "titel": "API-portaal Onderwijs en Vorming",
            "url": "https://onderwijs-api-portaal.vlaanderen.be/apis",
            "opmerking": "Onderwijsdoelen 1.0 + filters 1.0; API-key via aanvraagformulier.",
        },
        {
            "titel": "API-documentatie Kwalificaties & Curriculum",
            "url": "https://onderwijs-api-portaal.vlaanderen.be/node/126",
        },
        {
            "titel": "Data Onderwijs — documentencatalogus",
            "url": "https://data-onderwijs.vlaanderen.be/documenten/default.aspx",
        },
    ],
}
