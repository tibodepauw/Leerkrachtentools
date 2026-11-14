"""Source inventories and parsers. Downloaded artifacts remain separate from goals."""
from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from urllib.parse import quote

from .http import HttpCache, Resource, SourceBlocked
from .registry import Dataset
from .store import canonical

ADAPTER_VERSION = "2026-11-11.2"


class IncompleteSource(RuntimeError):
    pass


@dataclass
class Harvest:
    resources: list[Resource]
    inventory: list[dict]
    parse: Callable[[], list[dict]]
    coverage: dict

    def signature(self) -> str:
        # Discovery pages contain volatile nonces and unrelated news. Their
        # exact bytes remain provenance, while the discovered document inventory
        # and content hashes decide whether the goals need parsing again.
        value = {"parser": ADAPTER_VERSION, "inventory": self.inventory}
        return hashlib.sha256(canonical(value).encode()).hexdigest()


def go_new(dataset: Dataset, http: HttpCache) -> Harvest:
    from fetch_go_nieuw import GoNieuwFetcher
    from .documents import parse_document

    parser = GoNieuwFetcher()
    page = http.fetch(dataset.source_url)
    links = parser._extract_excel_links(page.text)
    if len(links) != 12:
        raise IncompleteSource(f"GO!: verwacht twaalf doelensets, gevonden {len(links)}; geen versie gepubliceerd.")
    resources = [page]
    inventory = []
    for link in links:
        resource = http.fetch(link["url"])
        if not resource.content.startswith(b"PK"):
            raise IncompleteSource("GO!-download is geen Excelbestand.")
        resources.append(resource)
        inventory.append({"url": link["url"], "label": link["label"], "sha256": resource.sha256})
    excel_resources = list(resources[1:])
    context_links = parser._extract_visie_pdf_links(page.text)
    for link in context_links:
        resource = http.fetch(link["url"])
        if not resource.content.startswith(b"%PDF"):
            raise IncompleteSource("GO!: visie-download is geen PDF.")
        resources.append(resource)
        inventory.append({"url": link["url"], "label": link["label"], "sha256": resource.sha256, "role": "context"})

    def parse():
        records = []
        for link, resource in zip(links, excel_resources, strict=True):
            parsed = parse_document("go_new", resource.path, link)
            for record in parsed:
                record.update(bron_url=link["url"], bron_titel=link["label"],
                              bron_sha256=resource.sha256, onderwijsniveau=dataset.level)
            records.extend(parsed)
        return records

    return Harvest(resources, inventory, parse, {"complete": True, "documents_expected": 12,
                   "documents_received": len(links), "context_documents": len(context_links), "edition": "nieuw leerplan, bronstatus niet als goedgekeurd verondersteld",
                   "evidence": "12 officiële Excel-doelensets; alle doelzin-rijen gecontroleerd"})


def collect(dataset: Dataset, http: HttpCache) -> Harvest:
    if dataset.adapter == "ovsg_authenticated":
        raise SourceBlocked("Deze ingelogde editie wordt expliciet vernieuwd met fetch:ovsg en beveiligde inlogbestanden; de vorige bronkopie blijft behouden.")
    if dataset.adapter in {"opstap", "ovsg", "pov"}:
        from .restricted import pov, restricted
        return (pov if dataset.adapter == "pov" else restricted)(dataset, http)
    if dataset.adapter == "go_new":
        return go_new(dataset, http)
    if dataset.adapter == "zill":
        return zill(dataset, http)
    if dataset.adapter == "go_old":
        from .go_old import go_old
        return go_old(dataset, http)
    if dataset.adapter == "secondary":
        from .secondary import secondary
        return secondary(dataset, http)
    if dataset.adapter == "education":
        from .education import education
        if getattr(http, "education_error", None) is not None:
            raise http.education_error
        try:
            return education(dataset, http)
        except Exception as error:
            if not hasattr(http, "education_bundle"):
                http.education_error = error
            raise
    raise ValueError(f"Onbekende bronadapter: {dataset.adapter}.")


def clean(value) -> str:
    return " ".join(str(value or "").split())


def zill_routes(soup, expression: str) -> dict[str, str]:
    routes = {}
    for anchor in soup.find_all("a", href=True):
        route = anchor["href"].removeprefix("#!")
        if route.endswith("/meer"):
            continue
        if re.fullmatch(expression, route):
            title = clean(anchor.get_text(" ", strip=True))
            if title or route not in routes:
                routes[route] = title
    return routes


def zill_goal(soup, *, field: str, theme: str, route: str, source_url: str) -> dict:
    root = soup.select_one("#doel-item")
    title = root.select_one("h5") if root else None
    if not title or not clean(title.get_text(" ", strip=True)):
        raise IncompleteSource("ZILL-doelpagina mist een herkenbare doeltekst.")
    parts = route.split("/")
    code = "".join(parts[-3:])
    heading = next((clean(item.get_text(" ", strip=True)) for item in soup.select("h3")
                    if clean(item.get_text(" ", strip=True)).startswith(code + " ")), None)
    if not heading:
        raise IncompleteSource("ZILL-code komt niet overeen met de ontdekte doelroute.")
    lines: dict[str, dict[str, list[str]]] = {}
    for timeline in root.select("section.cd-timeline"):
        declared = timeline.get("development-steps-bao", "")
        context = "AN" if "AN" in declared else "BuBaO" if "BuBao" in declared else "BaO"
        grouped = lines.setdefault(context, {})
        for block in timeline.select(".cd-timeline-block"):
            if block.find_parent(class_="cd-timeline-block"):
                continue
            descriptions = [clean(node.get_text(" ", strip=True))
                            for node in block.select(".cd-timeline-content [compile]")]
            descriptions = [text for text in descriptions if text]
            if not descriptions:
                continue
            age = block.select_one("age-range .label-ll")
            label = clean(age.get_text(" ", strip=True)) if age else ""
            items = grouped.setdefault(label, [])
            for description in descriptions:
                if description not in items:
                    items.append(description)

    def content_node(panel):
        heading = panel.select_one(".panel-title")
        nested = [item for item in panel.select(".panel") if item.find_parent(class_="panel") is panel]
        # Copy before removing nested panels to avoid mutating the source parser.
        from bs4 import BeautifulSoup
        own = BeautifulSoup(str(panel), "html.parser")
        for item in own.select(".panel .panel, section.cd-timeline, button, .panel-title"):
            item.decompose()
        return {"titel": clean(heading.get_text(" ", strip=True)) if heading else "",
                "beschrijving": clean(own.get_text(" ", strip=True)),
                "subcategorieen": [content_node(item) for item in nested]}

    contents = [content_node(panel) for panel in root.select("#accordion .panel")
                if panel.find_parent(class_="panel") is None]
    return {"code": code, "titel": clean(title.get_text(" ", strip=True)),
            "netwerk": "ZILL", "onderwijsniveau": "Basisonderwijs",
            "ontwikkelveld": field, "discipline": field, "subdomein": theme,
            "leerlijn": [{"leeftijd": label, "ontwikkelstappen": steps}
                         for label, steps in lines.get("BaO", {}).items()],
            "leerlijnen_per_context": {context: [{"leeftijd": label, "ontwikkelstappen": steps}
                for label, steps in values.items()] for context, values in lines.items()},
            "inhouden": contents, "bron_url": source_url,
            "bron_weergave": "publieke standaardweergave; alternatieve AN/BuBaO-weergaven niet afzonderlijk gevalideerd"}


def zill(dataset: Dataset, http: HttpCache) -> Harvest:
    from bs4 import BeautifulSoup

    resources = []
    inventory = []

    def page(route: str):
        url = dataset.source_url + "?_escaped_fragment_=" + quote(route, safe="/")
        resource = http.fetch(url)
        resources.append(resource)
        return BeautifulSoup(resource.content, "html.parser"), resource

    root, _ = page("/leerinhoud")
    fields = zill_routes(root, r"/leerinhoud/[A-Z]{2}")
    if len(fields) < 10:
        raise IncompleteSource(f"ZILL: slechts {len(fields)} van minimaal 10 ontwikkelvelden gevonden.")
    records = []
    theme_count = 0
    for field_route, field_name in fields.items():
        soup, _ = page(field_route)
        themes = zill_routes(soup, re.escape(field_route) + r"/[a-z]+")
        if not themes:
            raise IncompleteSource(f"ZILL: ontwikkelveld {field_route} heeft geen thema-inventaris.")
        for theme_route, theme_name in themes.items():
            theme_count += 1
            soup, _ = page(theme_route)
            goals = zill_routes(soup, re.escape(theme_route) + r"/\d+")
            if not goals:
                raise IncompleteSource(f"ZILL: thema {theme_route} heeft geen doeleninventaris.")
            logging.info("ZILL %s: %s doelen", theme_route, len(goals))
            for goal_route in goals:
                soup, resource = page(goal_route)
                record = zill_goal(soup, field=field_name, theme=theme_name, route=goal_route,
                                   source_url=dataset.source_url + "#!" + goal_route)
                record["bron_sha256"] = resource.sha256
                records.append(record)
                inventory.append({"route": goal_route, "sha256": resource.sha256,
                                  "field": field_name, "theme": theme_name})
    return Harvest(resources, inventory, lambda: records,
                   {"complete": True, "fields": len(fields), "themes": theme_count,
                    "goals_discovered": len(inventory), "goals_parsed": len(records),
                    "scope": "Alle doelen uit de publieke veld/thema-inventaris met hun standaard gerenderde inhoud",
                    "unverified_contexts": ["alternatieve AN-weergaven", "alternatieve BuBaO-weergaven"]})
