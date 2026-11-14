"""Explicit access checks; no stale snapshots or vision PDFs presented as goals."""
import json
import os
import re
from urllib.parse import quote, urljoin, urlsplit

from .adapters import Harvest, IncompleteSource
from .http import SourceBlocked

OVSG_OVERVIEW = "https://www.ovsg.be/onze-themas/leerplannen-didactiek/basisonderwijs/leer-lokaal/leerplan-leer-lokaal"


def restricted(dataset, http):
    from bs4 import BeautifulSoup
    if dataset.adapter == "ovsg":
        http.fetch(OVSG_OVERVIEW)
        raise SourceBlocked("OVSG: volledige doelen staan in afgeschermde Leer Lokaal-portalen. "
                            "Geen geautoriseerde bulkexport beschikbaar; publieke visieteksten zijn geen volledig leerplan.")
    page = http.fetch(dataset.source_url)
    soup = BeautifulSoup(page.content, "html.parser")
    scripts = [urljoin(dataset.source_url, node["src"]) for node in soup.find_all("script", src=True)
               if "op-stap-selector" in node["src"]]
    if len(scripts) != 1:
        raise IncompleteSource("Op.stap: actueel component niet eenduidig ontdekt.")
    component = http.fetch(scripts[0])
    if "krcItems" not in component.text:
        raise IncompleteSource("Op.stap: component is gewijzigd; nieuwe officiële exportroute controleren.")
    # Checking robots is enough. Do not download content at a disallowed endpoint.
    http.validate_url("https://cached-api.katholiekonderwijs.vlaanderen/")
    if not http.offline:
        http._check_robots("https://cached-api.katholiekonderwijs.vlaanderen",
                           "https://cached-api.katholiekonderwijs.vlaanderen/documents/")
    raise SourceBlocked("Op.stap: actuele doelen vereisen een toegestane bulkexport. "
                        "De bekende API is uitgesloten voor geautomatiseerd ophalen; oude Excel-exports worden niet als actueel gebruikt.")


def strict_list(payload):
    if isinstance(payload, dict):
        if any(payload.get(key) for key in ("next", "nextPage", "hasMore", "@odata.nextLink")):
            raise IncompleteSource("POV: gepagineerd antwoord vereist een gecontroleerd paginacontract.")
        counts = [payload[key] for key in ("total", "totalItems", "totalCount") if key in payload]
        payload = next((payload[key] for key in ("data", "items", "results", "leerplannen", "doelen")
                        if isinstance(payload.get(key), list)), None)
        if counts and any(str(value) != str(len(payload or [])) for value in counts):
            raise IncompleteSource("POV: opgegeven totaal wijkt af van de ontvangen lijst.")
    if not isinstance(payload, list) or not payload or not all(isinstance(row, dict) for row in payload):
        raise IncompleteSource("POV: geen volledige herkenbare objectlijst.")
    return payload


def pov(dataset, http):
    from fetch_pov_secondary_curricula import API_BASE, first_value, normalize_pov_goal
    overview = http.fetch(dataset.source_url)
    key = os.environ.get("POV_API_KEY", "").strip()
    if not key:
        raise SourceBlocked("POV: officiële Doelenverdeler-API vereist POV_API_KEY; sleutel ontbreekt. "
                            "Aanvragen via https://pov.classid.io/website/sapo-endpoints.")
    if len(key) > 500 or any(ord(char) < 32 for char in key):
        raise SourceBlocked("POV: ongeldige sleutelconfiguratie.")
    resource = http.fetch(API_BASE + "/list", headers={"api-key": key})
    curricula = strict_list(json.loads(resource.content))
    resources, inventory, records, seen = [overview, resource], [], [], set()
    for curriculum in curricula:
        identifier = str(first_value(curriculum, ("id", "leerplanId", "uuid")) or "")
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,150}", identifier) or identifier in seen:
            raise IncompleteSource("POV: ontbrekende of herhaalde leerplanidentiteit.")
        seen.add(identifier)
        detail = http.fetch(API_BASE + "/" + quote(identifier, safe="") + "/detailed", headers={"api-key": key})
        goals = strict_list(json.loads(detail.content))
        resources.append(detail)
        inventory.append({"curriculum": identifier, "sha256": detail.sha256})
        for goal in goals:
            row = normalize_pov_goal(goal, curriculum)
            if not row:
                raise IncompleteSource("POV: doel zonder volledige code of tekst; niets stilzwijgend overgeslagen.")
            row.update(bron_id=first_value(goal, ("id", "doelId", "uuid")),
                       onderwijsdoelenset={"onderwijsdoelenset_id": identifier},
                       bron_record=goal, bron_leerplan=curriculum, bron_sha256=detail.sha256,
                       bron_url=detail.url)
            records.append(row)
    return Harvest(resources, inventory, lambda: records,
                   {"complete": True, "curricula": len(curricula), "scope": "Volledige officiële API-lijst met alle detaildoelen"})
