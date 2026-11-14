"""Explicit, authenticated read-only collection of the 2027-2028 primary edition."""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import random
import re
import shutil
import subprocess
import time
from pathlib import Path
from urllib.parse import urlsplit

from .adapters import IncompleteSource
from .http import HttpCache, SourceBlocked
from .store import canonical

ROOT_URL = "https://leerlokaal.ovsg.be/bao/leerplan"
EDITION = "2027-2028"
PARSER_VERSION = 2


class AuthenticatedOVSGClient(HttpCache):
    """Only this explicitly invoked account workflow uses authenticated pages.

    The generic public crawler's robots policy is unchanged. No concealment,
    proxy rotation, unknown API routes or access to editorial functions.
    """
    def __init__(self, root, username, password, *, minimum=3, maximum=7, fresh=False, **options):
        if not (0 <= minimum <= maximum <= 30):
            raise ValueError("Ongeldige wachttijden.")
        self.minimum, self.maximum = minimum, maximum
        self.authorization = "Basic " + base64.b64encode((username + ":" + password).encode()).decode()
        super().__init__(root, {"leerlokaal.ovsg.be"}, recent_seconds=0 if fresh else 86400,
                         request_limit=options.pop("request_limit", 220), **options)

    def validate_url(self, url):
        url = super().validate_url(url)
        parsed = urlsplit(url)
        if parsed.query or not re.fullmatch(r"/bao/leerplan(?:/leergebied/[a-z]+|/leerlijn/[a-z0-9-]+)?", parsed.path):
            raise SourceBlocked("De ingelogde verzamelaar leest uitsluitend aangeboden basisleerplanpagina's.")
        return url

    def _request(self, url, headers, **options):
        self.pause = random.uniform(self.minimum, self.maximum)
        if self.metrics["requests"] and self.metrics["requests"] % 20 == 0:
            time.sleep(random.uniform(12, 20))
        return super()._request(url, {**headers, "Authorization": self.authorization},
                                limit=options["limit"], check_robots=False)


def decode_snapshot(resource, *, kind="primary"):
    script = Path(__file__).resolve().parents[1] / "parse_curriculum_snapshot.mjs"
    with resource.path.open("rb") as source:
        node = shutil.which("node")
        if not node:
            raise IncompleteSource("Node ontbreekt voor de veilige brondecoder.")
        try:
            result = subprocess.run([node, "--max-old-space-size=192", str(script), kind], stdin=source,
                                    capture_output=True, timeout=20, env={"PATH": __import__("os").defpath})
        except subprocess.TimeoutExpired:
            raise IncompleteSource("De brondecoder overschrijdt zijn tijdgrens.") from None
    if result.returncode or len(result.stdout) > 16 * 1024 * 1024:
        raise IncompleteSource("De bronstructuur is gewijzigd of overschrijdt de veilige parsergrens.")
    return json.loads(result.stdout)


def query_graph(data, name):
    values = [item["v"] for key, item in data.get("q", {}).items()
              if ("/" + name + "/") in key and isinstance(item, dict) and isinstance(item.get("v"), dict)]
    if len(values) != 1 or not all(key in values[0] for key in ("graaf", "register")):
        raise IncompleteSource(f"OVSG: bronquery {name} is niet eenduidig gevonden.")
    return values[0]


def entity(register, node):
    try:
        value = register[node["entiteit"]][node["uuid"]]
    except KeyError:
        raise IncompleteSource("OVSG: een aangeboden relatie mist haar bronentiteit.") from None
    if not isinstance(value, dict):
        raise IncompleteSource("OVSG: ongeldige bronentiteit.")
    return value


def plain(html):
    from bs4 import BeautifulSoup
    return " ".join(BeautifulSoup(html or "", "html.parser").get_text(" ", strip=True).split())


def validate_graph(graph):
    """Every offered reference, including nested cross-links, must resolve."""
    pending = [graph["graaf"]]
    while pending:
        value = pending.pop()
        if isinstance(value, dict):
            if "uuid" in value and "entiteit" in value:
                entity(graph["register"], value)
            pending.extend(value.values())
        elif isinstance(value, list):
            pending.extend(value)


def line_records(graph, line_id, field, resource, expected):
    validate_graph(graph)
    nodes = graph["graaf"].get("v2_leerlijn", [])
    if len(nodes) != 1 or nodes[0]["uuid"] != line_id:
        raise IncompleteSource("OVSG: verkeerde leerlijn ontvangen.")
    register = graph["register"]
    line = entity(register, nodes[0])
    goals = nodes[0].get("relaties", {}).get("v2_leerplandoelen", [])
    if len(goals) != expected or len({node["uuid"] for node in goals}) != expected:
        raise IncompleteSource("OVSG: doelentotaal wijkt af van de vakinventaris.")
    rows = []
    for node in goals:
        raw = entity(register, node)
        if raw.get("leerlijn_uuid") != line_id or not raw.get("code") or not plain(raw.get("omschrijving_html")):
            raise IncompleteSource("OVSG: doel mist tekst, code of juiste leerlijncontext.")
        relations = node.get("relaties", {})
        resolved = {}
        for relation, targets in relations.items():
            targets = targets if isinstance(targets, list) else [targets] if targets else []
            resolved[relation] = [dict(entity(register, target)) for target in targets]
        minimum = resolved.get("md_minimumdoelen", [])
        phase = raw.get("fase_nr")
        rows.append({"code": raw["code"], "titel": plain(raw["omschrijving_html"]),
            "discipline": field["titel"], "leergebied": field["titel"], "subdomein": line["titel"],
            "netwerk": "OVSG", "onderwijsniveau": "Basisonderwijs",
            "fase": f"Fase {phase}" if phase else raw.get("doelcategorie", ""),
            "leeftijd": raw.get("leeftijd", ""),
            "leerjaar_route": f"Leer Lokaal {EDITION} · " + (f"Fase {phase}" if phase else raw.get("doelcategorie", "")),
            "toelichting": f"Leer Lokaal, editie {EDITION}. " + raw.get("doelcategorie", ""),
            "bron_url": resource.url, "bron_id": raw["leerplandoel_uuid"],
            "onderwijsdoelenset": {"onderwijsdoelenset_id": "OVSG_BAO_2027_2028"},
            "bron_schooljaar": EDITION, "bron_titel": f"OVSG Leer Lokaal {EDITION}: {line['titel']}",
            "bron_sha256": resource.sha256, "bron_record": raw,
            "bron_relatieverwijzingen": relations,
            "ondersteuning": resolved.get("v2_ondersteuningsdoelen", []),
            "verdieping": resolved.get("v2_verdiepingsdoelen", []),
            "minimumdoelen": minimum, "bron_relatiegegevens": resolved,
            "gelinkt_minimumdoel": {"code": minimum[0]["code"],
                "tekst": minimum[0].get("omschrijving_tekst") or plain(minimum[0].get("omschrijving_html")),
                "type": minimum[0].get("bao_onderwijsdoeltype_korte_titel", "")} if minimum else None,
        })
    return rows


def collect_primary(http, progress=None):
    root = http.fetch(ROOT_URL)
    if "2027-2028" not in root.text:
        raise IncompleteSource("OVSG: de aangeboden editie is gewijzigd; niet stilzwijgend vervangen.")
    overview = query_graph(decode_snapshot(root), "laad_leergebieden")
    fields = overview["graaf"].get("v2_leergebied", [])
    if len(fields) != 9 or len({node["uuid"] for node in fields}) != 9:
        raise IncompleteSource("OVSG: geen volledige inventaris van negen leergebieden.")
    resources, rows, inventory, all_entities, line_ids = [root], [], [], {}, set()
    for field_node in fields:
        field = entity(overview["register"], field_node)
        field_resource = http.fetch(ROOT_URL + "/leergebied/" + field["code_slug"])
        resources.append(field_resource)
        graph = query_graph(decode_snapshot(field_resource), "laad_leergebied")
        field_nodes = graph["graaf"].get("v2_leergebied", [])
        if len(field_nodes) != 1 or field_nodes[0]["uuid"] != field_node["uuid"]:
            raise IncompleteSource("OVSG: onjuist leergebied ontvangen.")
        lines = field_nodes[0].get("relaties", {}).get("v2_leerlijnen", [])
        expected_lines = field_node.get("tellingen", {}).get("v2_leerlijnen")
        if len(lines) != expected_lines or len({n["uuid"] for n in lines}) != expected_lines:
            raise IncompleteSource("OVSG: leerlijnentotaal wijkt af van het overzicht.")
        for line_node in lines:
            line_id = line_node["uuid"]
            if line_id in line_ids:
                raise IncompleteSource("OVSG: dezelfde leerlijn staat dubbel in de vakinventaris.")
            line_ids.add(line_id)
            line = entity(graph["register"], line_node)
            resource = http.fetch(ROOT_URL + "/leerlijn/" + line["code_slug"])
            resources.append(resource)
            parsed = query_graph(decode_snapshot(resource), "laad_leerlijn")
            expected = line_node.get("tellingen", {}).get("v2_leerplandoelen")
            if not isinstance(expected, int) or expected < 0:
                raise IncompleteSource("OVSG: geen betrouwbaar doeltotaal per leerlijn.")
            new_rows = line_records(parsed, line_id, field, resource, expected)
            rows.extend(new_rows)
            inventory.append({"field": field["code"], "line": line["code"], "uuid": line_id,
                              "expected": expected, "received": len(new_rows), "sha256": resource.sha256})
            for kind, members in parsed["register"].items():
                for identifier, member in members.items():
                    # A breadcrumb/pill and a full entity can expose different
                    # fields. Preserve every distinct source variant losslessly.
                    variant = hashlib.sha256(canonical(member).encode()).hexdigest()
                    key = kind + ":" + identifier + ":" + variant
                    if key not in all_entities:
                        all_entities[key] = {"id": hashlib.sha256(key.encode()).hexdigest(), "domain": "BASISONDERWIJS",
                            "validity": "editie " + EDITION, "source_url": resource.url, "source_sha256": resource.sha256,
                            "payload": {"entiteit": kind, "uuid": identifier, "gegevens": member}}
            # Preserve the exact finite relation graph too, independent of flattening.
            key = "graph:" + line_id
            all_entities[key] = {"id": hashlib.sha256(key.encode()).hexdigest(), "domain": "BASISONDERWIJS",
                "validity": "editie " + EDITION, "source_url": resource.url, "source_sha256": resource.sha256,
                "payload": {"leerlijn_uuid": line_id, "graaf": parsed["graaf"], "index": parsed.get("index", {})}}
            logging.info("OVSG %s: %s/%s doelen; %s leerlijnen verwerkt", line["code"], len(new_rows), expected, len(line_ids))
            if progress:
                progress({"edition": EDITION, "lines": len(line_ids), "goals": len(rows),
                          "requests": http.metrics["requests"], "complete": False})
    if len(line_ids) != sum(n["tellingen"]["v2_leerlijnen"] for n in fields):
        raise IncompleteSource("OVSG: totaal aantal leerlijnen niet volledig.")
    if len({row["bron_id"] for row in rows}) != len(rows):
        raise IncompleteSource("OVSG: leerplandoel verschijnt in meer dan één eigenaarleerlijn.")
    return rows, resources, inventory, list(all_entities.values())
