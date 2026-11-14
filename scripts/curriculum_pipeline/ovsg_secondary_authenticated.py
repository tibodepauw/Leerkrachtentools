"""Read-only secondary account inventory, with lossless finite source graphs."""
from __future__ import annotations

import hashlib
import logging
import re
from urllib.parse import urlsplit

from .adapters import IncompleteSource
from .http import HttpCache, SourceBlocked
from .ovsg_authenticated import AuthenticatedOVSGClient, decode_snapshot, entity, plain, validate_graph
from .store import canonical

ROOT = "https://leerlokaal.ovsg.be/so/leerplannen"
DATASET = "OVSG_SECUNDAIR_2025"
PARSER_VERSION = 2


class SecondaryOVSGClient(AuthenticatedOVSGClient):
    def __init__(self, *args, **options):
        super().__init__(*args, request_limit=600, **options)

    def validate_url(self, url):
        url = HttpCache.validate_url(self, url)
        parsed = urlsplit(url)
        pattern = r"/so/leerplannen(?:/[AB]-(?:bv|bo|op)(?:/(?:sleutelcompetenties|basisopties)(?:/[A-Za-z0-9-]+/leerlijnen(?:/[A-Za-z0-9-]+)?)?)?)?"
        if parsed.query or not re.fullmatch(pattern, parsed.path):
            raise SourceBlocked("De secundaire verzamelaar leest uitsluitend aangeboden leerplanpagina's.")
        return url


def page_data(resource):
    data = decode_snapshot(resource, kind="secondary")
    if not isinstance(data, list):
        raise IncompleteSource("OVSG secundair: gewijzigde paginagegevens.")
    result = {}
    for item in data:
        if not isinstance(item, dict):
            continue
        for key, value in item.get("data", {}).items():
            if key.startswith(("data_", "concordantie_")):
                if key in result:
                    raise IncompleteSource("OVSG secundair: dubbele paginagegevens.")
                result[key] = value
    return result


def graph_nodes(data, key, kind, expected=None):
    graph = data.get(key)
    if not isinstance(graph, dict) or not isinstance(graph.get("entiteiten"), dict):
        raise IncompleteSource("OVSG secundair: inventaris ontbreekt.")
    if kind not in graph.get("bronnen", {}):
        raise IncompleteSource("OVSG secundair: inventarisgroep ontbreekt.")
    validate_graph({"graaf":graph["bronnen"], "register":graph["entiteiten"]})
    nodes = graph["bronnen"].get(kind, [])
    if (not nodes and (expected != 0 or kind == "slot")) or len({node["uuid"] for node in nodes}) != len(nodes):
        raise IncompleteSource("OVSG secundair: lege of dubbele inventaris.")
    if expected is not None and len(nodes) != expected:
        raise IncompleteSource("OVSG secundair: inventaristotaal wijkt af van bovenliggend overzicht.")
    return graph, nodes


def secondary_rows(graph, plan, section, line, resource):
    register = graph["entiteiten"]
    slots = {node["uuid"] for node in graph["bronnen"].get("slot", [])}
    # Each slot has one concrete source type. Prerequisite slots remain context,
    # alongside all support/deepening entities, rather than fake central goals.
    concrete = {}
    for kind, members in register.items():
        if kind == "slot":
            continue
        for identifier, raw in members.items():
            if raw.get("slot_uuid") in slots:
                if identifier in concrete:
                    raise IncompleteSource("OVSG secundair: slot heeft meerdere concrete typen.")
                concrete[identifier] = (kind, raw)
    expected_concrete = {identifier for identifier in slots if register["slot"][identifier].get("slug") != "leeg"}
    if set(concrete) != expected_concrete:
        raise IncompleteSource("OVSG secundair: niet ieder aangeboden slot is opgelost.")
    rows = []
    references = {}
    pending = [graph["bronnen"]]
    while pending:
        value = pending.pop()
        if isinstance(value, dict):
            if value.get("uuid") in slots and value.get("entiteit") != "slot":
                references.setdefault(value["uuid"], []).append(value)
            pending.extend(value.values())
        elif isinstance(value, list):
            pending.extend(value)
    for identifier, (kind, raw) in concrete.items():
        if not raw.get("doel_uuid"):
            if raw.get("slug") not in {"voorkennis-bao", "voorkennis-so"}:
                raise IncompleteSource("OVSG secundair: onbekend slottype zonder doelidentiteit.")
            continue
        if not raw.get("code") or not plain(raw.get("omschrijving_html")):
            raise IncompleteSource("OVSG secundair: doel mist code of tekst.")
        fragments = raw.get("code_fragmenten", {})
        if any(fragments.get(key) != line["code_fragmenten"].get(key) for key in ("stroom", "leerplan", "indeling", "leerlijn")):
            raise IncompleteSource("OVSG secundair: doel komt uit een andere leerlijn.")
        rows.append({"code":raw["code"], "titel":plain(raw["omschrijving_html"]),
            "netwerk":"OVSG", "onderwijsniveau":"Secundair", "graad":"1ste graad",
            "stroom":plan["code_fragmenten"]["stroom"],
            "discipline":section.get("sleutelcompetentie_titel_alias") or section.get("basisoptie_titel") or section["code"],
            "subdomein":line["titel"], "leerjaar_route":plan["stroom_titel"]+" · "+plan["leerjaar"],
            "toelichting":plan["titel"]+" · "+plan["nummer"], "bron_url":resource.url,
            "bron_id":identifier, "bron_doel_id":raw["doel_uuid"], "bron_doeltype":kind,
            "bron_sha256":resource.sha256, "bron_record":raw, "bron_leerplan":plan,
            "bron_relatieverwijzingen":references.get(identifier, []),
            "onderwijsdoelenset":{"onderwijsdoelenset_id":plan["leerplan_uuid"]}})
    if not rows:
        raise IncompleteSource("OVSG secundair: leerlijn bevat geen centrale doelen; vorige export blijft behouden.")
    return rows


def collect_secondary(http, progress=None):
    resources, rows, inventory, records = [], [], [], {}
    def load(url):
        resource = http.fetch(url)
        resources.append(resource)
        data = page_data(resource)
        # Curriculum data only: never persist the decoded account object.
        for name, graph in data.items():
            key = hashlib.sha256((url+":"+name).encode()).hexdigest()
            records[key] = {"id":key,"domain":"SECUNDAIR","validity":"broneditie 2025",
                "source_url":url,"source_sha256":resource.sha256,"payload":graph}
        return resource, data
    _, root = load(ROOT)
    root_graph, plans = graph_nodes(root, "data_leerplannen", "leerplan", 5)
    seen_lines = set()
    for plan_node in plans:
        plan = entity(root_graph["entiteiten"], plan_node)
        if not str(plan.get("nummer", "")).startswith("2025/"):
            raise IncompleteSource("OVSG secundair: broneditie gewijzigd; expliciete controle vereist.")
        plan_url = ROOT+"/"+plan["code_slug"]+"/"+plan["indelingtype_slug"]
        _, data = load(plan_url)
        section_graph, sections = graph_nodes(data,"data_indelingen","indeling",plan_node["tellingen"]["indeling"])
        for section_node in sections:
            section = entity(section_graph["entiteiten"], section_node)
            section_url = plan_url+"/"+section["code_fragment"]+"/leerlijnen"
            _, data = load(section_url)
            line_graph, lines = graph_nodes(data,"data_leerlijnen","leerlijn",section_node["tellingen"]["leerlijn"])
            for line_node in lines:
                line = entity(line_graph["entiteiten"],line_node)
                if line_node["uuid"] in seen_lines:
                    raise IncompleteSource("OVSG secundair: dubbele eigenaarleerlijn.")
                seen_lines.add(line_node["uuid"])
                resource, data = load(section_url+"/"+line["code_fragment"])
                graph, slots = graph_nodes(data,"data_slots_en_sporen","slot")
                new_rows = secondary_rows(graph,plan,section,line,resource)
                rows.extend(new_rows)
                inventory.append({"plan":plan["code"],"section":section["code"],"line":line["code"],
                    "uuid":line_node["uuid"],"slots":len(slots),"goals":len(new_rows),"sha256":resource.sha256})
                logging.info("OVSG secundair %s: %s doelen, %s slots; %s leerlijnen",line["code"],len(new_rows),len(slots),len(inventory))
                if progress:
                    progress({"lines":len(inventory),"goals":len(rows),"requests":http.metrics["requests"],"complete":False})
    if len({row["bron_id"] for row in rows}) != len(rows):
        raise IncompleteSource("OVSG secundair: botsende slotidentiteiten.")
    return rows, resources, inventory, list(records.values())
