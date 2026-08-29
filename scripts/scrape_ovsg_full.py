#!/usr/bin/env python3
"""
Exporteer de volledige OVSG Leer Lokaal-leerlijn naar JSON Lines.

Strategie:
  1. Verifieer HTTP Basic Auth (Playwright + requests).
  2. Onderschep netwerkverkeer op zoek naar bulk-JSON-API's.
  3. Fallback: crawl alle leergebieden en leerlijn-pagina's via requests,
     parseer de SSR HTML en extraheer doelen per fase en leerlijn-niveau.

Gebruik:
  export OVSG_LEERLOKAAL_USER=...
  export OVSG_LEERLOKAAL_PASSWORD=...
  python3 scripts/scrape_ovsg_full.py
  python3 scripts/scrape_ovsg_full.py --limit 5 -v

Installatie:
  pip install -r scripts/requirements-curriculum.txt
  python3 -m playwright install chromium
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from playwright.async_api import Response, async_playwright

BASE_URL = "https://leerlokaal.ovsg.be"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data/ovsg/ovsg_volledig.jsonl"
REPORT_PATH = OUTPUT_PATH.with_name("ovsg_scrape_report.json")
METADATA_PATH = OUTPUT_PATH.with_suffix(OUTPUT_PATH.suffix + ".meta.json")
SSR_PARSER_SCRIPT = Path(__file__).resolve().parent / "ovsg_parse_ssr.js"

LEERGEBIED_CODES = ("DIG", "SRC", "LEE", "GEZ", "IDW", "FRA", "NED", "WIS", "KUC")

LEERGEBIED_NAMES: dict[str, str] = {
    "DIG": "Digitale geletterdheid",
    "SRC": "Sociaal-relationele competenties",
    "LEE": "Leercompetenties",
    "GEZ": "Gezondheid",
    "IDW": "De wereld en ik",
    "FRA": "Frans",
    "NED": "Nederlands",
    "WIS": "Wiskunde",
    "KUC": "Kunst en cultuur",
}

# Kolomvolgorde op leerlijn-rasters (links → rechts).
FASE_BY_COL = ("Uitbreiding", "Fase 4", "Fase 3", "Fase 2", "Fase 1", "Aanloop")

JSON_CONTENT_TYPES = ("application/json", "application/ld+json")
INTERESTING_PATH_RE = re.compile(
    r"(?i)(doel|leerlijn|leerplan|curriculum|content|data|api|tree|node)"
)
LEERLIJN_PATH_RE = re.compile(r"^/leerplan/leerlijn-[A-Z]{3}-")
LEERGEBIED_FROM_URL_RE = re.compile(r"leerlijn-([A-Z]{3})-")
TITLE_LEERGEBIED_RE = re.compile(r"Leergebied\s+(.+)$", re.I)

logger = logging.getLogger("scrape_ovsg_full")


def configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def auth_from_env() -> tuple[str, str]:
    username = os.environ.get("OVSG_LEERLOKAAL_USER", "").strip()
    password = os.environ.get("OVSG_LEERLOKAAL_PASSWORD", "").strip()
    if not username or not password:
        raise ValueError(
            "Stel OVSG_LEERLOKAAL_USER en OVSG_LEERLOKAAL_PASSWORD in "
            "(bijv. via .env.local of export)."
        )
    return username, password


@dataclass
class ScrapeReport:
    strategy: str = ""
    unique_goals: int = 0
    leergebieden: list[str] = field(default_factory=list)
    leerlijn_pages: int = 0
    json_endpoints: list[str] = field(default_factory=list)
    failed_pages: list[dict[str, str]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    niveau_counts: dict[str, int] = field(default_factory=dict)
    fase_counts: dict[str, int] = field(default_factory=dict)
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


@dataclass
class GoalRecord:
    code: str
    leergebied: str
    fase: str
    niveau: str
    titel: str
    toelichting: str
    netwerk: str = "OVSG"
    bron_url: str = BASE_URL

    def dedupe_key(self) -> tuple[str, ...]:
        code = self.code.strip()
        if code:
            return (code, self.leergebied, self.fase, self.niveau)
        return (
            self.leergebied,
            self.fase,
            self.niveau,
            clean_text(self.titel).casefold(),
        )

    def as_dict(self) -> dict[str, str]:
        return {
            "code": self.code,
            "leergebied": self.leergebied,
            "fase": self.fase,
            "niveau": self.niveau,
            "titel": self.titel,
            "toelichting": self.toelichting,
            "netwerk": self.netwerk,
            "bron_url": self.bron_url,
        }


def format_fase(value: Any) -> str:
    raw = clean_text(str(value or ""))
    if not raw:
        return ""
    if raw.upper() == "U":
        return "Uitbreiding"
    if raw.upper() == "L":
        return "Aanloop"
    if raw.isdigit():
        return f"Fase {raw}"
    if raw.lower().startswith("fase"):
        return raw
    return raw


def compact_leerplan_code(leerplan_code: Any) -> str:
    if not isinstance(leerplan_code, dict):
        return ""
    voluit = clean_text(str(leerplan_code.get("voluit") or ""))
    parts = leerplan_code.get("onderdelen")
    if isinstance(parts, dict):
        gebied = clean_text(str(parts.get("leergebied_code") or ""))
        thema = clean_text(str(parts.get("thema_code") or ""))
        leerlijn = clean_text(str(parts.get("leerlijn_code") or ""))
        doel_type = clean_text(str(parts.get("doel_type") or ""))
        doel_code = clean_text(str(parts.get("doel_code") or ""))
        if gebied and thema and leerlijn and doel_type and doel_code:
            return f"{gebied}{thema}{leerlijn}{doel_type}.{doel_code}"
    if voluit:
        return re.sub(r"\s+", "", voluit)
    return ""


def parse_ssr_payload(html: str) -> dict[str, Any] | None:
    if not SSR_PARSER_SCRIPT.exists():
        return None
    try:
        completed = subprocess.run(
            ["node", str(SSR_PARSER_SCRIPT)],
            input=html,
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )
    except (subprocess.SubprocessError, FileNotFoundError) as exc:
        logger.debug("SSR-parser niet beschikbaar: %s", exc)
        return None

    raw = completed.stdout.strip()
    if not raw or raw == "null":
        return None
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def iter_goal_objects(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        return [item for item in value.values() if isinstance(item, dict)]
    return []


class OvsgSsrParser:
    """Haal doelen uit embedded SvelteKit SSR-data."""

    def __init__(self, payload: dict[str, Any], *, fallback_leergebied: str) -> None:
        self.payload = payload
        self.fallback_leergebied = fallback_leergebied

    def extract(self) -> list[GoalRecord]:
        records: list[GoalRecord] = []
        last_kolom = self.payload.get("laatste_kolom_nummer", 0)
        try:
            kolom_count = int(last_kolom)
        except (TypeError, ValueError):
            kolom_count = 0

        for index in range(1, kolom_count + 1):
            kolom = self.payload.get(f"kolom_{index}")
            if not isinstance(kolom, dict):
                continue
            server_data = kolom.get("server_data")
            if not isinstance(server_data, dict):
                continue
            leerlijn_data = server_data.get("leerlijn_data")
            if not isinstance(leerlijn_data, dict):
                continue
            leergebied = clean_text(
                str(
                    (leerlijn_data.get("leergebied") or {}).get("titel")
                    or self.fallback_leergebied
                )
            )
            records.extend(self._extract_leerlijn_data(leerlijn_data, leergebied))
        return records

    def _extract_leerlijn_data(
        self, leerlijn_data: dict[str, Any], leergebied: str
    ) -> list[GoalRecord]:
        records: list[GoalRecord] = []
        for row in leerlijn_data.get("basisdoelen_nieuw") or []:
            if not isinstance(row, dict):
                continue
            fase = format_fase(row.get("fase"))
            for goal in row.get("basisdoelen") or []:
                if not isinstance(goal, dict):
                    continue
                titel = clean_text(str(goal.get("omschrijving") or ""))
                if not titel:
                    continue
                records.append(
                    GoalRecord(
                        code=compact_leerplan_code(goal.get("leerplan_code")),
                        leergebied=leergebied,
                        fase=fase,
                        niveau="Basis",
                        titel=titel,
                        toelichting="",
                    )
                )
                for sub in goal.get("ondersteuningsdoelen") or []:
                    records.extend(
                        self._subdoel_records(sub, leergebied, fase, "Ondersteuning")
                    )
                for sub in goal.get("verdiepingsdoelen") or []:
                    records.extend(
                        self._subdoel_records(sub, leergebied, fase, "Verdieping")
                    )

        for goal in iter_goal_objects(leerlijn_data.get("aanloopdoelen")):
            titel = clean_text(str(goal.get("omschrijving") or ""))
            if titel:
                records.append(
                    GoalRecord(
                        code=clean_text(str(goal.get("code") or "")),
                        leergebied=leergebied,
                        fase="Aanloop",
                        niveau="Basis",
                        titel=titel,
                        toelichting="",
                    )
                )

        for goal in iter_goal_objects(leerlijn_data.get("uitbreidingsdoelen")):
            titel = clean_text(str(goal.get("omschrijving") or ""))
            if titel:
                records.append(
                    GoalRecord(
                        code=clean_text(str(goal.get("code") or "")),
                        leergebied=leergebied,
                        fase="Uitbreiding",
                        niveau="Basis",
                        titel=titel,
                        toelichting="",
                    )
                )
        return records

    @staticmethod
    def _subdoel_records(
        goal: Any, leergebied: str, fase: str, niveau: str
    ) -> list[GoalRecord]:
        if not isinstance(goal, dict):
            return []
        titel = clean_text(str(goal.get("omschrijving") or ""))
        if not titel:
            return []
        return [
            GoalRecord(
                code=clean_text(str(goal.get("code") or "")),
                leergebied=leergebied,
                fase=fase,
                niveau=niveau,
                titel=titel,
                toelichting="",
            )
        ]


class OvsgHtmlParser:
    """Parse SSR HTML van een OVSG-leerlijn-pagina."""

    def __init__(self, html: str, *, leergebied: str, page_url: str) -> None:
        self.soup = BeautifulSoup(html, "html.parser")
        self.leergebied = leergebied
        self.page_url = page_url

    def extract(self) -> list[GoalRecord]:
        records: list[GoalRecord] = []
        for cell in self.soup.find_all(
            "div", class_=lambda classes: classes and "svelte-95y1oc" in classes
        ):
            if not self._in_leeftijd_row(cell):
                continue
            fase = self._fase_for_cell(cell)
            records.extend(self._extract_basis(cell, fase))
            records.extend(self._extract_ondersteuning(cell, fase))
            records.extend(self._extract_verdieping(cell, fase))
        return records

    @staticmethod
    def _in_leeftijd_row(element: Any) -> bool:
        node = element
        for _ in range(25):
            if node is None:
                return False
            classes = " ".join(node.get("class", []))
            if re.search(r"grid_rij_leeftijd_\d+", classes):
                return True
            node = node.parent
        return False

    @staticmethod
    def _column_index(cell: Any) -> int:
        parent = cell.parent
        if parent is None:
            return -1
        siblings = [
            child
            for child in parent.children
            if hasattr(child, "get")
            and "svelte-95y1oc" in " ".join(child.get("class", []))
        ]
        return siblings.index(cell) if cell in siblings else -1

    def _fase_for_cell(self, cell: Any) -> str:
        index = self._column_index(cell)
        if 0 <= index < len(FASE_BY_COL):
            return FASE_BY_COL[index]
        return ""

    @staticmethod
    def _extract_code(luik: Any) -> str:
        if luik is None:
            return ""
        code_div = luik.find(
            "div", class_=lambda classes: classes and classes == ["code", "svelte-12s4jen"]
        )
        if code_div is None:
            code_div = luik.find("div", class_="code")
        if code_div is None:
            return ""
        return re.sub(r"Selecteer$", "", code_div.get_text(strip=True)).strip()

    def _extract_basis(self, cell: Any, fase: str) -> list[GoalRecord]:
        records: list[GoalRecord] = []
        for basis in cell.find_all(
            "div", class_=lambda classes: classes and "basisdoel" in classes
        ):
            luik = basis.find("div", class_=lambda classes: classes and "luik" in classes)
            code = self._extract_code(luik)
            text_parts: list[str] = []
            for child in basis.children:
                if not hasattr(child, "get") or child is luik:
                    continue
                text = clean_text(child.get_text(" ", strip=True))
                if text and len(text) > 5:
                    text_parts.append(text)
            titel = clean_text(" ".join(text_parts))
            if not titel:
                titel = clean_text(basis.get_text(" ", strip=True))
            if code:
                titel = re.sub(re.escape(code) + r"\s*Selecteer\s*", "", titel).strip()
            titel = re.sub(r"\s*Selecteer\s*$", "", titel).strip()
            if not titel:
                continue
            records.append(
                GoalRecord(
                    code=code,
                    leergebied=self.leergebied,
                    fase=fase,
                    niveau="Basis",
                    titel=titel,
                    toelichting=self._find_toelichting(basis),
                )
            )
        return records

    def _extract_ondersteuning(self, cell: Any, fase: str) -> list[GoalRecord]:
        records: list[GoalRecord] = []
        for block in cell.find_all(
            "div",
            class_=lambda classes: classes and "ondersteuningsdoelen" in classes,
        ):
            for sub in block.find_all(
                "div",
                class_=lambda classes: classes
                and "svelte-95y1oc" in classes
                and "is_subdoel" in classes,
            ):
                titel = clean_text(sub.get_text(" ", strip=True))
                if not titel:
                    continue
                records.append(
                    GoalRecord(
                        code="",
                        leergebied=self.leergebied,
                        fase=fase,
                        niveau="Ondersteuning",
                        titel=titel,
                        toelichting=self._find_toelichting(sub),
                    )
                )
        return records

    def _extract_verdieping(self, cell: Any, fase: str) -> list[GoalRecord]:
        records: list[GoalRecord] = []
        for block in cell.find_all(
            "div",
            class_=lambda classes: classes and "verdiepingsdoelen" in classes,
        ):
            for sub in block.find_all(
                "div",
                class_=lambda classes: classes
                and "svelte-95y1oc" in classes
                and "is_subdoel" in classes,
            ):
                titel = clean_text(sub.get_text(" ", strip=True))
                if not titel:
                    continue
                records.append(
                    GoalRecord(
                        code="",
                        leergebied=self.leergebied,
                        fase=fase,
                        niveau="Verdieping",
                        titel=titel,
                        toelichting=self._find_toelichting(sub),
                    )
                )
        return records

    @staticmethod
    def _find_toelichting(element: Any) -> str:
        for node in element.find_all(True):
            classes = " ".join(node.get("class", []))
            if re.search(r"toelicht|wenk|didact|voorbeeld", classes, re.I):
                text = clean_text(node.get_text(" ", strip=True))
                if text:
                    return text
            title = node.get("title")
            if isinstance(title, str) and len(title.strip()) > 40:
                if not title.startswith("Ontwikkelingsdoelen"):
                    return clean_text(title)
        return ""


class OvsgScraper:
    def __init__(
        self,
        *,
        username: str,
        password: str,
        output: Path = OUTPUT_PATH,
        headless: bool = True,
        timeout_ms: int = 90_000,
        limit: int | None = None,
        skip_playwright: bool = False,
    ) -> None:
        self.username = username
        self.password = password
        self.output = output
        self.report_path = output.with_name("ovsg_scrape_report.json")
        self.metadata_path = output.with_suffix(output.suffix + ".meta.json")
        self.headless = headless
        self.timeout_ms = timeout_ms
        self.limit = limit
        self.skip_playwright = skip_playwright
        self.report = ScrapeReport()
        self.session = requests.Session()
        self.session.auth = (username, password)
        self.session.headers.update(
            {
                "User-Agent": (
                    "Leerkrachtentools-OVSG-scraper/1.0 (+https://github.com/local)"
                ),
                "Accept": "text/html,application/json,*/*",
            }
        )

    async def run(self) -> None:
        if not self.skip_playwright:
            await self._verify_with_playwright()
        else:
            self._verify_with_requests()

        json_payloads = await self._discover_json_endpoints()
        records: list[GoalRecord]
        if json_payloads:
            self.report.strategy = "network-json"
            records = self._records_from_json_payloads(json_payloads)
        else:
            self.report.strategy = "dom-crawl"
            records = self._records_from_dom_crawl()

        self._finalize_report(records)
        self._write_output(records)

    async def _verify_with_playwright(self) -> None:
        logger.info("Playwright: toegang tot %s verifiëren …", BASE_URL)
        captured: list[str] = []

        async def on_response(response: Response) -> None:
            content_type = (response.headers.get("content-type") or "").split(";")[0]
            path = urlparse(response.url).path
            if content_type in JSON_CONTENT_TYPES or INTERESTING_PATH_RE.search(path):
                if response.status == 200 and content_type.startswith("application/json"):
                    captured.append(response.url)

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=self.headless)
            context = await browser.new_context(
                http_credentials={
                    "username": self.username,
                    "password": self.password,
                }
            )
            page = await context.new_page()
            page.on("response", on_response)
            response = await page.goto(
                BASE_URL + "/",
                wait_until="domcontentloaded",
                timeout=self.timeout_ms,
            )
            if response is None or response.status != 200:
                status = response.status if response else "geen respons"
                raise RuntimeError(f"Playwright-toegang mislukt (status {status})")

            title = await page.title()
            if "Leer Lokaal" not in title:
                raise RuntimeError(f"Onverwachte paginatitel: {title!r}")

            await page.goto(
                f"{BASE_URL}/leergebied/NED",
                wait_until="domcontentloaded",
                timeout=self.timeout_ms,
            )
            await browser.close()

        self.report.json_endpoints = sorted(set(captured))
        if self.report.json_endpoints:
            logger.info(
                "Playwright vond %s JSON-responses (geen bulk-export)",
                len(self.report.json_endpoints),
            )
        else:
            logger.info("Playwright: geen bruikbare bulk-JSON gevonden op startpagina's")

    def _verify_with_requests(self) -> None:
        logger.info("Requests: toegang tot %s verifiëren …", BASE_URL)
        response = self.session.get(BASE_URL + "/", timeout=60)
        response.raise_for_status()
        if "Leer Lokaal" not in response.text:
            raise RuntimeError("Requests-toegang: onverwachte homepage-inhoud")

    async def _discover_json_endpoints(self) -> list[Any]:
        if not self.report.json_endpoints:
            return []
        payloads: list[Any] = []
        for url in self.report.json_endpoints:
            try:
                response = self.session.get(url, timeout=60)
                response.raise_for_status()
                payloads.append(response.json())
            except Exception as exc:
                self.report.warn(f"JSON-endpoint niet bruikbaar ({url}): {exc}")
        return payloads

    def _records_from_json_payloads(self, payloads: list[Any]) -> list[GoalRecord]:
        records: list[GoalRecord] = []
        for payload in payloads:
            if isinstance(payload, dict):
                maybe = payload.get("results") or payload.get("data") or payload.get("items")
                if isinstance(maybe, list):
                    for item in maybe:
                        record = self._goal_from_json_item(item)
                        if record is not None:
                            records.append(record)
        if records:
            return self._dedupe(records)
        self.report.warn(
            "JSON-endpoints bevatten geen herkenbare doelen; val terug op DOM-crawl."
        )
        return self._records_from_dom_crawl()

    def _goal_from_json_item(self, item: Any) -> GoalRecord | None:
        if not isinstance(item, dict):
            return None
        titel = clean_text(
            str(item.get("titel") or item.get("title") or item.get("omschrijving") or "")
        )
        if not titel:
            return None
        leergebied = clean_text(
            str(item.get("leergebied") or item.get("field") or "")
        ) or "Onbekend"
        fase = clean_text(str(item.get("fase") or item.get("phase") or ""))
        niveau_raw = clean_text(str(item.get("niveau") or item.get("level") or "Basis"))
        niveau = self._normalize_niveau(niveau_raw)
        return GoalRecord(
            code=clean_text(str(item.get("code") or item.get("doelcode") or "")),
            leergebied=leergebied,
            fase=fase,
            niveau=niveau,
            titel=titel,
            toelichting=clean_text(
                str(item.get("toelichting") or item.get("description") or "")
            ),
        )

    @staticmethod
    def _normalize_niveau(value: str) -> str:
        lowered = value.casefold()
        if "ondersteun" in lowered or lowered in {"o", "ondersteuning"}:
            return "Ondersteuning"
        if "verdiep" in lowered or lowered in {"v", "verdieping"}:
            return "Verdieping"
        return "Basis"

    def _records_from_dom_crawl(self) -> list[GoalRecord]:
        leerlijn_urls = self._collect_leerlijn_urls()
        if self.limit is not None:
            leerlijn_urls = leerlijn_urls[: max(1, self.limit)]

        records: list[GoalRecord] = []
        ssr_pages = 0
        dom_pages = 0
        for index, url in enumerate(leerlijn_urls, start=1):
            leergebied = self._leergebied_for_url(url)
            try:
                response = self.session.get(url, timeout=90)
                response.raise_for_status()
                page_records, used_ssr = self._extract_page_records(
                    response.text,
                    leergebied=leergebied,
                    page_url=url,
                )
                if used_ssr:
                    ssr_pages += 1
                else:
                    dom_pages += 1
                records.extend(page_records)
                logger.info(
                    "[%s/%s] %s → %s doelen",
                    index,
                    len(leerlijn_urls),
                    url.replace(BASE_URL, ""),
                    len(page_records),
                )
            except Exception as exc:
                message = str(exc)
                self.report.failed_pages.append({"url": url, "reden": message})
                logger.error("Fout bij %s: %s", url, message)

        if ssr_pages and dom_pages:
            self.report.strategy = "ssr-data+dom-fallback"
        elif ssr_pages:
            self.report.strategy = "ssr-data"
        else:
            self.report.strategy = "dom-crawl"

        return self._dedupe(records)

    def _extract_page_records(
        self, html: str, *, leergebied: str, page_url: str
    ) -> tuple[list[GoalRecord], bool]:
        payload = parse_ssr_payload(html)
        if payload:
            records = OvsgSsrParser(
                payload, fallback_leergebied=leergebied
            ).extract()
            if records:
                return records, True
            self.report.warn(f"SSR-data zonder doelen op {page_url}; DOM-fallback.")

        return (
            OvsgHtmlParser(
                html,
                leergebied=leergebied,
                page_url=page_url,
            ).extract(),
            False,
        )

    def _collect_leerlijn_urls(self) -> list[str]:
        urls: set[str] = set()
        for code in LEERGEBIED_CODES:
            page_url = f"{BASE_URL}/leergebied/{code}"
            try:
                response = self.session.get(page_url, timeout=60)
                response.raise_for_status()
            except Exception as exc:
                self.report.failed_pages.append(
                    {"url": page_url, "reden": f"leergebied niet bereikbaar: {exc}"}
                )
                continue

            leergebied_name = self._leergebied_name_from_html(response.text, code)
            if leergebied_name not in self.report.leergebieden:
                self.report.leergebieden.append(leergebied_name)

            soup = BeautifulSoup(response.text, "html.parser")
            for anchor in soup.find_all("a", href=True):
                href = anchor["href"]
                if LEERLIJN_PATH_RE.match(href):
                    urls.add(urljoin(BASE_URL, href))

        ordered = sorted(urls)
        self.report.leerlijn_pages = len(ordered)
        logger.info(
            "Gevonden: %s leerlijn-pagina's in %s leergebieden",
            len(ordered),
            len(self.report.leergebieden),
        )
        return ordered

    def _leergebied_for_url(self, url: str) -> str:
        match = LEERGEBIED_FROM_URL_RE.search(url)
        if not match:
            return "Onbekend"
        code = match.group(1)
        return LEERGEBIED_NAMES.get(code, code)

    @staticmethod
    def _leergebied_name_from_html(html: str, fallback_code: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        title = soup.find("title")
        if title:
            title_text = clean_text(title.get_text(" ", strip=True))
            match = TITLE_LEERGEBIED_RE.search(title_text)
            if match:
                return clean_text(match.group(1))
        return LEERGEBIED_NAMES.get(fallback_code, fallback_code)

    @staticmethod
    def _dedupe(records: Iterable[GoalRecord]) -> list[GoalRecord]:
        seen: set[tuple[str, ...]] = set()
        unique: list[GoalRecord] = []
        for record in records:
            key = record.dedupe_key()
            if key in seen:
                continue
            seen.add(key)
            unique.append(record)
        return unique

    def _finalize_report(self, records: list[GoalRecord]) -> None:
        self.report.unique_goals = len(records)
        niveau_counter = Counter(record.niveau for record in records)
        fase_counter = Counter(record.fase or "Onbekend" for record in records)
        self.report.niveau_counts = dict(sorted(niveau_counter.items()))
        self.report.fase_counts = dict(sorted(fase_counter.items()))
        if not records:
            raise ValueError("Geen OVSG-doelen geëxtraheerd")

    def _write_output(self, records: list[GoalRecord]) -> None:
        self.output.parent.mkdir(parents=True, exist_ok=True)
        with self.output.open("w", encoding="utf-8") as handle:
            for record in records:
                handle.write(json.dumps(record.as_dict(), ensure_ascii=False) + "\n")

        metadata = {
            "network": "OVSG",
            "onderwijsniveau": "basisonderwijs",
            "brontitel": "OVSG Leer Lokaal - volledige leerlijn",
            "source_url": BASE_URL,
            "record_count": len(records),
            "format": "application/x-ndjson",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "scrape_strategy": self.report.strategy,
        }
        self.metadata_path.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        self.report.write(self.report_path)

        logger.info("JSONL opgeslagen: %s", self.output)
        logger.info("Metadata opgeslagen: %s", self.metadata_path)
        logger.info("Rapport opgeslagen: %s", self.report_path)
        logger.info(
            "Eindresultaat: %s unieke doelen; %s leerlijn-pagina's; %s fouten",
            self.report.unique_goals,
            self.report.leerlijn_pages,
            len(self.report.failed_pages),
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Exporteer OVSG Leer Lokaal naar JSONL."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_PATH,
        help=f"JSONL-uitvoerpad (standaard: {OUTPUT_PATH})",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Toon Chromium tijdens Playwright-verificatie.",
    )
    parser.add_argument(
        "--skip-playwright",
        action="store_true",
        help="Sla Playwright-verificatie over (alleen requests).",
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
        help="Beperk het aantal leerlijn-pagina's (lokale tests).",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


async def async_main(args: argparse.Namespace) -> int:
    username, password = auth_from_env()
    scraper = OvsgScraper(
        username=username,
        password=password,
        output=args.output,
        headless=not args.headed,
        timeout_ms=args.timeout * 1_000,
        limit=args.limit,
        skip_playwright=args.skip_playwright,
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
        logger.exception("OVSG-scrape mislukt")
        return 1


if __name__ == "__main__":
    sys.exit(main())
