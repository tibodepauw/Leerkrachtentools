#!/usr/bin/env python3
"""
Exporteer de volledige publieke ZILL-taxonomie naar JSON Lines.

Primaire strategie:
  1. open de officiële ZILL-selector met Playwright;
  2. onderschep het netwerkverzoek dat het volledige curriculummodel ophaalt;
  3. haal datzelfde JSON-model via Playwrights request-context op;
  4. reconstrueer velden, thema's, doelen, leerlijnen en geneste inhouden.

Fallback:
  Navigeer via de DOM door alle velden, subdomeinen en doelen, bezoek voor elk
  doel zowel /leerlijn als /inhouden, klap inklapbare onderdelen open en
  verzamel de zichtbare tekst.

Gebruik:
  python3 scripts/scrape_zill_full.py
  python3 scripts/scrape_zill_full.py --dom-only
  python3 scripts/scrape_zill_full.py --headed --limit 5

Installatie:
  pip install -r scripts/requirements-curriculum.txt
  python3 -m playwright install chromium
"""

from __future__ import annotations

import argparse
import asyncio
import html
import json
import logging
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup
from playwright.async_api import (
    BrowserContext,
    Page,
    Response,
    async_playwright,
)

BASE_URL = "https://zill-selector.katholiekonderwijs.vlaanderen"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data/zill/zill_volledig.jsonl"
REPORT_PATH = OUTPUT_PATH.with_name("zill_scrape_report.json")
METADATA_PATH = OUTPUT_PATH.with_suffix(OUTPUT_PATH.suffix + ".meta.json")

CURRICULUM_TYPES = (
    "CURRICULUM_ZILL,"
    "CURRICULUM_ZILL_CLUSTER,"
    "CURRICULUM_ZILL_DEVELOPMENT_FIELD,"
    "CURRICULUM_ZILL_DEVELOPMENT_THEME,"
    "CURRICULUM_ZILL_GENERIC_GOAL,"
    "CURRICULUM_ZILL_DEVELOPMENT_CONTENT,"
    "CURRICULUM_ZILL_LEERLIJN,"
    "CURRICULUM_ZILL_LEERLIJN_PRE_REFERENCE,"
    "CURRICULUM_ZILL_LEERLIJN_CLUSTER,"
    "CURRICULUM_ZILL_LEERLIJN_POST_REFERENCE,"
    "CURRICULUM_ZILL_CONTENT_GROUP"
)

FIELD_TYPE = "CURRICULUM_ZILL_DEVELOPMENT_FIELD"
THEME_TYPE = "CURRICULUM_ZILL_DEVELOPMENT_THEME"
GOAL_TYPE = "CURRICULUM_ZILL_GENERIC_GOAL"
CONTENT_GROUP_TYPE = "CURRICULUM_ZILL_CONTENT_GROUP"
CONTENT_TYPE = "CURRICULUM_ZILL_DEVELOPMENT_CONTENT"
LEARNING_LINE_TYPE = "CURRICULUM_ZILL_LEERLIJN"
STEP_TYPES = {
    "CURRICULUM_ZILL_LEERLIJN_CLUSTER",
    "CURRICULUM_ZILL_LEERLIJN_PRE_REFERENCE",
    "CURRICULUM_ZILL_LEERLIJN_POST_REFERENCE",
}

AGE_RE = re.compile(r"(?P<start>\d+(?:[.,]\d+)?)\s*-\s*(?P<end>\d+(?:[.,]\d+)?)\s*j", re.I)
GOAL_ROUTE_RE = re.compile(
    r"^#/(?P<field>[^/]+)/(?P<theme>[^/]+)/(?P<goal>[^/]+)"
    r"/(?P<view>leerlijn|inhouden)$"
)

logger = logging.getLogger("scrape_zill_full")


def configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )


def unwrap(value: dict[str, Any]) -> dict[str, Any]:
    expanded = value.get("$$expanded")
    return expanded if isinstance(expanded, dict) else value


def href_key(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    href = value.get("href")
    if not isinstance(href, str) or not href:
        return None
    return href.rstrip("/").split("/")[-1]


def first_identifier(item: dict[str, Any]) -> str:
    identifiers = item.get("identifiers")
    if isinstance(identifiers, list) and identifiers:
        return str(identifiers[0])
    return ""


def relation_sort_key(relation: dict[str, Any]) -> tuple[int, str]:
    relation = unwrap(relation)
    raw_order = relation.get("readorder", 999_999)
    try:
        order = int(raw_order)
    except (TypeError, ValueError):
        order = 999_999
    return order, href_key(relation.get("from")) or ""


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    source = html.unescape(str(value))
    soup = BeautifulSoup(source, "html.parser")
    for br in soup.find_all("br"):
        br.replace_with(" ")
    return re.sub(r"\s+", " ", soup.get_text(" ")).strip(" \t•")


def age_label(start: Any, end: Any) -> str:
    def number(value: Any) -> str:
        try:
            numeric = float(value)
            if numeric.is_integer():
                return str(int(numeric))
            return f"{numeric:g}"
        except (TypeError, ValueError):
            return str(value or "?")

    return f"{number(start)}-{number(end)}j"


@dataclass
class ScrapeReport:
    strategy: str = ""
    unique_goals: int = 0
    fields: list[str] = field(default_factory=list)
    failed_routes: list[dict[str, str]] = field(default_factory=list)
    missing_routes: list[dict[str, str]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    source_model_url: str | None = None
    started_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    finished_at: str | None = None

    def warn(self, message: str) -> None:
        self.warnings.append(message)
        logger.warning(message)

    def write(self, path: Path) -> None:
        self.finished_at = datetime.now(timezone.utc).isoformat()
        path.write_text(
            json.dumps(self.__dict__, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


class ZillGraph:
    """Relationele ZILL-API-respons omzetten naar compacte doelrecords."""

    def __init__(self, payload: dict[str, Any]) -> None:
        results = payload.get("results")
        if not isinstance(results, list):
            raise ValueError("ZILL-respons bevat geen lijst in 'results'")

        entities = [unwrap(item) for item in results if isinstance(item, dict)]
        self.by_key: dict[str, dict[str, Any]] = {
            str(item["key"]): item for item in entities if item.get("key")
        }
        self.by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in entities:
            self.by_type[str(item.get("type", ""))].append(item)

        if not self.by_type[GOAL_TYPE]:
            raise ValueError("ZILL-respons bevat geen generieke doelen")

    def children(
        self, parent: dict[str, Any], accepted_types: set[str] | None = None
    ) -> list[dict[str, Any]]:
        children: list[tuple[dict[str, Any], dict[str, Any]]] = []
        seen: set[str] = set()

        for raw_relation in parent.get("$$relationsTo", []):
            relation = unwrap(raw_relation)
            if relation.get("relationtype") != "IS_PART_OF":
                continue
            key = href_key(relation.get("from"))
            child = self.by_key.get(key or "")
            if not child or key in seen:
                continue
            if accepted_types is not None and child.get("type") not in accepted_types:
                continue
            seen.add(key or "")
            children.append((relation, child))

        children.sort(key=lambda pair: relation_sort_key(pair[0]))
        return [child for _, child in children]

    def parent(
        self, child: dict[str, Any], accepted_type: str
    ) -> dict[str, Any] | None:
        for raw_relation in child.get("$$relationsFrom", []):
            relation = unwrap(raw_relation)
            if relation.get("relationtype") != "IS_PART_OF":
                continue
            candidate = self.by_key.get(href_key(relation.get("to")) or "")
            if candidate and candidate.get("type") == accepted_type:
                return candidate
        return None

    def learning_line(
        self, owner: dict[str, Any]
    ) -> list[dict[str, Any]]:
        lines = self.children(owner, {LEARNING_LINE_TYPE})
        grouped: dict[str, list[str]] = {}
        order: list[str] = []

        for line in lines:
            for step in self.children(line, STEP_TYPES):
                text = clean_text(step.get("description") or step.get("title"))
                if not text:
                    continue
                label = age_label(step.get("startage"), step.get("endage"))
                if label not in grouped:
                    grouped[label] = []
                    order.append(label)
                if text not in grouped[label]:
                    grouped[label].append(text)

        return [
            {"leeftijd": label, "ontwikkelstappen": grouped[label]}
            for label in order
        ]

    def content_node(
        self, item: dict[str, Any], ancestors: set[str]
    ) -> dict[str, Any]:
        key = str(item.get("key", ""))
        node: dict[str, Any] = {"titel": clean_text(item.get("title"))}

        description = clean_text(item.get("description"))
        if description:
            node["beschrijving"] = description

        line = self.learning_line(item)
        if line:
            node["leerlijn"] = line

        if key in ancestors:
            node["waarschuwing"] = "cyclische relatie overgeslagen"
            return node

        nested = self.children(item, {CONTENT_TYPE})
        if nested:
            next_ancestors = ancestors | {key}
            node["subcategorieen"] = [
                self.content_node(child, next_ancestors) for child in nested
            ]
        return node

    def goal_contents(self, goal: dict[str, Any]) -> list[dict[str, Any]]:
        output: list[dict[str, Any]] = []
        groups = self.children(goal, {CONTENT_GROUP_TYPE})
        for group in groups:
            group_contents = self.children(group, {CONTENT_TYPE})
            if group.get("title"):
                group_node: dict[str, Any] = {
                    "titel": clean_text(group.get("title")),
                    "subcategorieen": [
                        self.content_node(item, set()) for item in group_contents
                    ],
                }
                group_line = self.learning_line(group)
                if group_line:
                    group_node["leerlijn"] = group_line
                output.append(group_node)
            else:
                output.extend(self.content_node(item, set()) for item in group_contents)
        return output

    def records(self, limit: int | None = None) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []

        fields = sorted(
            self.by_type[FIELD_TYPE],
            key=lambda item: first_identifier(item),
        )
        for field_item in fields:
            field_code = first_identifier(field_item)
            for theme in self.children(field_item, {THEME_TYPE}):
                theme_code = first_identifier(theme)
                for goal in self.children(theme, {GOAL_TYPE}):
                    goal_number = first_identifier(goal)
                    code = f"{field_code}{theme_code}{goal_number}"
                    learning_line = self.learning_line(goal)
                    contents = self.goal_contents(goal)
                    default_view = "leerlijn" if learning_line else "inhouden"
                    record = {
                        "code": code,
                        "ontwikkelveld": clean_text(field_item.get("title")),
                        "subdomein": clean_text(theme.get("title")),
                        "titel": clean_text(goal.get("title")),
                        "leerlijn": learning_line,
                        "inhouden": contents,
                        "bron_url": (
                            f"{BASE_URL}/#/{field_code}/{theme_code}/"
                            f"{goal_number}/{default_view}"
                        ),
                    }
                    records.append(record)
                    if limit is not None and len(records) >= limit:
                        return records

        return records


class ZillScraper:
    def __init__(
        self,
        *,
        output: Path,
        headless: bool,
        timeout_ms: int,
        limit: int | None,
        dom_only: bool,
    ) -> None:
        self.output = output
        self.report_path = output.with_name(REPORT_PATH.name)
        self.metadata_path = output.with_suffix(output.suffix + ".meta.json")
        self.headless = headless
        self.timeout_ms = timeout_ms
        self.limit = limit
        self.dom_only = dom_only
        self.report = ScrapeReport()
        self._model_request: dict[str, Any] | None = None

    async def run(self) -> list[dict[str, Any]]:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=self.headless)
            context = await browser.new_context(
                locale="nl-BE",
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "Chrome/131 Safari/537.36"
                ),
            )
            page = await context.new_page()
            page.set_default_timeout(self.timeout_ms)
            page.on("response", self._observe_response)

            records: list[dict[str, Any]] = []
            if not self.dom_only:
                try:
                    records = await self._extract_from_network(page, context)
                    self.report.strategy = "network-json"
                except Exception as exc:
                    self.report.warn(
                        f"Netwerk-JSON kon niet worden verwerkt; DOM-fallback: {exc}"
                    )

            if not records:
                self.report.strategy = "dom-fallback"
                records = await self._extract_from_dom(page)

            await browser.close()

        self._validate(records)
        self._write_output(records)
        return records

    def _observe_response(self, response: Response) -> None:
        parsed = urlparse(response.url)
        query = parse_qs(parsed.query)
        is_full_model = (
            parsed.path.rstrip("/") == "/content"
            and "root" in query
            and "typeIn" in query
            and "CURRICULUM_ZILL_GENERIC_GOAL" in query["typeIn"][0]
        )
        if is_full_model and response.status == 200:
            self._model_request = {
                "url": response.url,
                "headers": response.request.headers,
            }
            self.report.source_model_url = response.url
            logger.info("Volledig ZILL-JSON-model onderschept")

    async def _extract_from_network(
        self, page: Page, context: BrowserContext
    ) -> list[dict[str, Any]]:
        logger.info("Open ZILL-selector en onderschep curriculummodel")
        await page.goto(
            f"{BASE_URL}/#/",
            wait_until="domcontentloaded",
            timeout=self.timeout_ms,
        )
        await page.wait_for_selector("body.loaded", timeout=self.timeout_ms)

        for _ in range(50):
            if self._model_request:
                break
            await page.wait_for_timeout(100)
        if not self._model_request:
            raise RuntimeError("geen volledig curriculumnetwerkverzoek waargenomen")

        request_headers = {
            key: value
            for key, value in self._model_request["headers"].items()
            if key.lower() in {"vsko-resource-hash", "accept", "referer"}
        }
        response = await context.request.get(
            self._model_request["url"],
            headers=request_headers,
            timeout=self.timeout_ms,
        )
        if not response.ok:
            raise RuntimeError(
                f"curriculum-API antwoordde met HTTP {response.status}"
            )
        payload = await response.json()
        graph = ZillGraph(payload)
        records = graph.records(self.limit)
        logger.info(
            "Ruw model verwerkt: %s entiteiten, %s doelen",
            len(graph.by_key),
            len(records),
        )
        return records

    async def _extract_from_dom(self, page: Page) -> list[dict[str, Any]]:
        logger.info("Start DOM-fallback: velden → subdomeinen → doelen")
        await self._goto_loaded(page, f"{BASE_URL}/#/")

        field_links = await self._links(page, r"^#/[^/]+$")
        field_links = [
            item
            for item in field_links
            if item["href"] not in {"#/", "#/search", "#/review"}
        ]
        field_links = self._deduplicate_links(field_links)

        records: list[dict[str, Any]] = []
        seen_codes: set[str] = set()

        for field_link in field_links:
            field_code = field_link["href"].split("/")[-1]
            field_name = field_link["text"]
            if field_code not in self.report.fields:
                self.report.fields.append(field_code)

            await self._goto_loaded(page, f"{BASE_URL}/{field_link['href']}")
            theme_pattern = rf"^#/{re.escape(field_code)}/[^/]+$"
            theme_links = self._deduplicate_links(
                await self._links(page, theme_pattern)
            )

            for theme_link in theme_links:
                theme_code = theme_link["href"].split("/")[-1]
                theme_name = theme_link["text"]
                await self._goto_loaded(page, f"{BASE_URL}/{theme_link['href']}")

                route_links = await self._links(
                    page,
                    (
                        rf"^#/{re.escape(field_code)}/{re.escape(theme_code)}"
                        r"/[^/]+/(?:leerlijn|inhouden)$"
                    ),
                )
                routes_by_goal: dict[str, dict[str, str]] = defaultdict(dict)
                for link in route_links:
                    match = GOAL_ROUTE_RE.match(link["href"])
                    if match:
                        routes_by_goal[match.group("goal")][match.group("view")] = (
                            link["href"]
                        )

                for goal_number, views in routes_by_goal.items():
                    code = f"{field_code}{theme_code}{goal_number}"
                    if code in seen_codes:
                        continue

                    expected = {
                        "leerlijn": (
                            f"#/{field_code}/{theme_code}/{goal_number}/leerlijn"
                        ),
                        "inhouden": (
                            f"#/{field_code}/{theme_code}/{goal_number}/inhouden"
                        ),
                    }
                    extracted: dict[str, Any] = {}
                    title = ""

                    # Beide routes worden altijd expliciet bezocht, ook wanneer de
                    # navigatieknop voor een lege weergave verborgen staat.
                    for view, route in expected.items():
                        try:
                            await self._goto_loaded(page, f"{BASE_URL}/{route}")
                            await self._expand_all(page)
                            route_data = await self._extract_dom_view(page, view)
                            extracted[view] = route_data
                            title = title or route_data.get("titel", "")
                            if route not in views.values():
                                self.report.missing_routes.append(
                                    {
                                        "code": code,
                                        "route": f"{BASE_URL}/{route}",
                                        "reden": "geen zichtbare navigatielink; route wel bezocht",
                                    }
                                )
                        except Exception as exc:
                            self.report.failed_routes.append(
                                {
                                    "code": code,
                                    "route": f"{BASE_URL}/{route}",
                                    "fout": str(exc),
                                }
                            )
                            logger.error("Route mislukt %s: %s", route, exc)

                    records.append(
                        {
                            "code": code,
                            "ontwikkelveld": field_name,
                            "subdomein": theme_name,
                            "titel": title,
                            "leerlijn": extracted.get("leerlijn", {}).get(
                                "leerlijn", []
                            ),
                            "inhouden": extracted.get("inhouden", {}).get(
                                "inhouden", []
                            ),
                            "bron_url": (
                                f"{BASE_URL}/#/{field_code}/{theme_code}/"
                                f"{goal_number}/leerlijn"
                            ),
                        }
                    )
                    seen_codes.add(code)
                    logger.info("DOM-doel %s geëxtraheerd", code)
                    if self.limit is not None and len(records) >= self.limit:
                        return records

        return records

    async def _goto_loaded(self, page: Page, url: str) -> None:
        await page.goto(url, wait_until="domcontentloaded", timeout=self.timeout_ms)
        await page.wait_for_selector("body.loaded", timeout=self.timeout_ms)
        await page.wait_for_timeout(150)

    async def _links(self, page: Page, pattern: str) -> list[dict[str, str]]:
        values = await page.locator("a[href]").evaluate_all(
            """
            (elements, pattern) => {
              const regex = new RegExp(pattern);
              return elements
                .map((a) => ({
                  href: a.getAttribute("href") || "",
                  text: (a.textContent || a.title || "").trim()
                }))
                .filter((item) => regex.test(item.href));
            }
            """,
            pattern,
        )
        return [
            {"href": str(item["href"]), "text": str(item["text"])}
            for item in values
        ]

    @staticmethod
    def _deduplicate_links(
        links: Iterable[dict[str, str]],
    ) -> list[dict[str, str]]:
        output: list[dict[str, str]] = []
        positions: dict[str, int] = {}
        for link in links:
            position = positions.get(link["href"])
            if position is not None:
                if len(link["text"]) > len(output[position]["text"]):
                    output[position] = link
                continue
            positions[link["href"]] = len(output)
            output.append(link)
        return output

    async def _expand_all(self, page: Page) -> None:
        selectors = (
            ".c-hamburger--htx:not(.is-active), "
            ".panel-heading .collapsed, "
            "a.collapsed, "
            ".fa-plus-circle"
        )
        for _ in range(12):
            buttons = page.locator(selectors)
            clicked = 0
            for index in range(await buttons.count()):
                button = buttons.nth(index)
                try:
                    if await button.is_visible():
                        await button.click(timeout=1_000)
                        clicked += 1
                except Exception:
                    continue
            if not clicked:
                break
            await page.wait_for_timeout(100)

    async def _extract_dom_view(
        self, page: Page, view: str
    ) -> dict[str, Any]:
        container_selector = "#goalContainer2" if view == "leerlijn" else "#goalContainer"
        container = page.locator(container_selector)
        await container.wait_for(state="attached", timeout=self.timeout_ms)

        code = ""
        title = ""
        header_cells = container.locator(".table-doeldetail td")
        for index in range(await header_cells.count()):
            text = clean_text(await header_cells.nth(index).inner_text())
            if re.fullmatch(r"[A-Z]{2}[a-z]{2}\d+", text):
                code = text
            elif text and not title and len(text) > 8 and text != code:
                title = text

        if view == "leerlijn":
            grouped: dict[str, list[str]] = {}
            order: list[str] = []
            blocks = container.locator(".cd-timeline-block")
            for index in range(await blocks.count()):
                text = clean_text(await blocks.nth(index).inner_text())
                match = AGE_RE.search(text)
                if not match:
                    continue
                label = age_label(
                    match.group("start").replace(",", "."),
                    match.group("end").replace(",", "."),
                )
                description = clean_text(text[match.end() :])
                if not description:
                    continue
                if label not in grouped:
                    grouped[label] = []
                    order.append(label)
                if description not in grouped[label]:
                    grouped[label].append(description)
            return {
                "code": code,
                "titel": title,
                "leerlijn": [
                    {"leeftijd": label, "ontwikkelstappen": grouped[label]}
                    for label in order
                ],
            }

        raw_text = await container.inner_text()
        ignored = {code, title, "0", "inhouden", "leerlijn"}
        lines = [
            clean_text(line)
            for line in raw_text.splitlines()
            if line
            and not clean_text(line).isdigit()
            and line.lower() not in {item.lower() for item in ignored if item}
        ]
        lines = [line for line in lines if line]
        # De fallback bewaart alle zichtbare tekst. De primaire JSON-strategie
        # levert daarnaast de exacte categoriehiërarchie en sub-leerlijnen.
        return {
            "code": code,
            "titel": title,
            "inhouden": [{"titel": line} for line in dict.fromkeys(lines)],
        }

    def _validate(self, records: list[dict[str, Any]]) -> None:
        codes = [record.get("code", "") for record in records]
        unique_codes = set(codes)
        duplicates = sorted(code for code in unique_codes if codes.count(code) > 1)
        if duplicates:
            raise ValueError(f"Dubbele doelcodes gevonden: {', '.join(duplicates)}")
        if any(not code for code in codes):
            raise ValueError("Een of meer records hebben geen doelcode")

        self.report.unique_goals = len(unique_codes)
        self.report.fields = sorted(
            {
                re.match(r"^[A-Z]{2}", code).group(0)
                for code in unique_codes
                if re.match(r"^[A-Z]{2}", code)
            }
        )
        if not records:
            raise ValueError("Geen ZILL-doelen geëxtraheerd")
        empty_records = [
            record["code"]
            for record in records
            if not record["leerlijn"] and not record["inhouden"]
        ]
        for code in empty_records:
            self.report.missing_routes.append(
                {
                    "code": code,
                    "route": (
                        f"{BASE_URL}/#/{code[:2]}/{code[2:4]}/{code[4:]}/"
                        "(leerlijn|inhouden)"
                    ),
                    "reden": "doel heeft in het officiële model geen leerlijn of inhouden",
                }
            )
        if empty_records:
            self.report.warn(
                f"{len(empty_records)} doelen hebben geen leerlijn of inhouden: "
                + ", ".join(empty_records)
            )
        logger.info(
            "Validatie geslaagd: %s unieke doelen in %s ontwikkelvelden",
            len(unique_codes),
            len(self.report.fields),
        )

    def _write_output(self, records: list[dict[str, Any]]) -> None:
        self.output.parent.mkdir(parents=True, exist_ok=True)
        with self.output.open("w", encoding="utf-8") as handle:
            for record in records:
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")

        metadata = {
            "network": "ZILL",
            "onderwijsniveau": "lager onderwijs",
            "brontitel": "ZILL-selector — volledig leerplan",
            "source_url": BASE_URL,
            "record_count": len(records),
            "format": "application/x-ndjson",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        self.metadata_path.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        self.report.write(self.report_path)

        logger.info("JSONL opgeslagen: %s", self.output)
        logger.info("Rapport opgeslagen: %s", self.report_path)
        logger.info(
            "Eindresultaat: %s unieke doelen; %s gefaalde routes; "
            "%s ontbrekende of lege routes",
            self.report.unique_goals,
            len(self.report.failed_routes),
            len(self.report.missing_routes),
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Exporteer de volledige publieke ZILL-selector naar JSONL."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_PATH,
        help=f"JSONL-uitvoerpad (standaard: {OUTPUT_PATH})",
    )
    parser.add_argument(
        "--dom-only",
        action="store_true",
        help="Sla netwerk-JSON over en test de route-per-route DOM-fallback.",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Toon Chromium tijdens het scrapen.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=90,
        help="Timeout per browseractie in seconden (standaard: 90).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Beperk het aantal doelen (alleen voor lokale tests).",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


async def async_main(args: argparse.Namespace) -> int:
    scraper = ZillScraper(
        output=args.output,
        headless=not args.headed,
        timeout_ms=args.timeout * 1_000,
        limit=args.limit,
        dom_only=args.dom_only,
    )
    await scraper.run()
    return 0


def main() -> int:
    args = parse_args()
    configure_logging(args.verbose)
    try:
        return asyncio.run(async_main(args))
    except KeyboardInterrupt:
        logger.error("Scrape onderbroken door gebruiker")
        return 130
    except Exception:
        logger.exception("ZILL-scrape mislukt")
        return 1


if __name__ == "__main__":
    sys.exit(main())
