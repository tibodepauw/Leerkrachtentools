#!/usr/bin/env python3
"""
Exporteer de volledige Op.stap-leerroutes naar JSON Lines.

Strategie:
  1. Verifieer toegang via Playwright en onderschep de krcItems-API.
  2. Haal het volledige curriculummodel op via cached-api.katholiekonderwijs.vlaanderen.
  3. Verrijk doelen met minimumdoel-koppelingen via de agodi-endpoint.
  4. Fallback: DOM-traversal in de op-stap-selector webcomponent.

Gebruik:
  python3 scripts/scrape_opstap_full.py
  python3 scripts/scrape_opstap_full.py --dom-only -v

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
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from playwright.async_api import Response, async_playwright

BASE_URL = "https://opstap.katholiekonderwijs.vlaanderen"
API_BASE = "https://cached-api.katholiekonderwijs.vlaanderen"
DOCUMENT_ID = "bdc19260-bd4c-46a8-8009-b2a54f381120"
SNAPSHOT_VERSION = "1.2"
KRC_ITEMS_URL = (
    f"{API_BASE}/documents/{DOCUMENT_ID}/snapshots/{SNAPSHOT_VERSION}/krcItems"
)

OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data/opstap/opstap_volledig.jsonl"
REPORT_PATH = OUTPUT_PATH.with_name("opstap_scrape_report.json")
METADATA_PATH = OUTPUT_PATH.with_suffix(OUTPUT_PATH.suffix + ".meta.json")

GOAL_TYPE = "KRC_CURRICULUM_GOAL"
MINIMUM_GOAL_RE = re.compile(r"/agodi/onderwijsdoelen/opstap/(\d+)")

logger = logging.getLogger("scrape_opstap_full")


def configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = html.unescape(str(value))
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def unwrap(item: dict[str, Any]) -> dict[str, Any]:
    expanded = item.get("$$expanded")
    return expanded if isinstance(expanded, dict) else item


def href_key(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    href = value.get("href")
    if not isinstance(href, str) or not href:
        return None
    return href.rstrip("/").split("/")[-1]


@dataclass
class ScrapeReport:
    strategy: str = ""
    unique_goals: int = 0
    disciplines: dict[str, int] = field(default_factory=dict)
    minimum_goals_fetched: int = 0
    minimum_goals_failed: int = 0
    json_endpoints: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
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
class MinimumGoal:
    code: str = ""
    tekst: str = ""
    type: str = ""

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "tekst": self.tekst, "type": self.type}


@dataclass
class GoalRecord:
    code: str
    discipline: str
    subdomein: str
    titel: str
    leerjaar_route: str
    toelichting: str
    gelinkt_minimumdoel: MinimumGoal
    netwerk: str = "OPSTAP"
    bron_url: str = BASE_URL + "/"

    def dedupe_key(self) -> tuple[str, ...]:
        mg = self.gelinkt_minimumdoel
        return (
            self.code,
            self.leerjaar_route,
            mg.code if mg else "",
            clean_text(self.titel).casefold(),
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "discipline": self.discipline,
            "subdomein": self.subdomein,
            "titel": self.titel,
            "leerjaar_route": self.leerjaar_route,
            "toelichting": self.toelichting,
            "gelinkt_minimumdoel": self.gelinkt_minimumdoel.as_dict(),
            "netwerk": self.netwerk,
            "bron_url": self.bron_url,
        }


class MinimumGoalCache:
    def __init__(self, session: requests.Session, report: ScrapeReport) -> None:
        self.session = session
        self.report = report
        self._cache: dict[str, MinimumGoal] = {}

    def get(self, agodi_path: str) -> MinimumGoal:
        match = MINIMUM_GOAL_RE.search(agodi_path)
        if not match:
            return MinimumGoal()
        goal_id = match.group(1)
        if goal_id in self._cache:
            return self._cache[goal_id]

        url = f"{API_BASE}{agodi_path}"
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            payload = response.json()
            record = MinimumGoal(
                code=clean_text(str(payload.get("uniqueCode") or payload.get("code") or "")),
                tekst=clean_text(payload.get("title") or ""),
                type=clean_text(str(payload.get("type") or "")),
            )
            self.report.minimum_goals_fetched += 1
        except Exception as exc:
            self.report.minimum_goals_failed += 1
            logger.debug("Minimumdoel %s mislukt: %s", agodi_path, exc)
            record = MinimumGoal()

        self._cache[goal_id] = record
        return record


class OpstapGraph:
    def __init__(self, payload: dict[str, Any]) -> None:
        items = payload.get("items")
        if not isinstance(items, list):
            raise ValueError("Op.stap-respons bevat geen 'items'")

        entities = [unwrap(item) for item in items if isinstance(item, dict)]
        self.by_key: dict[str, dict[str, Any]] = {
            str(item["key"]): item for item in entities if item.get("key")
        }
        self.goals = [item for item in entities if item.get("type") == GOAL_TYPE]
        if not self.goals:
            raise ValueError("Op.stap-respons bevat geen curriculumsdoelen")

    def subdomein_for(self, goal: dict[str, Any]) -> str:
        subdomain = goal.get("subdomain") if isinstance(goal.get("subdomain"), dict) else {}
        domain = goal.get("domain") if isinstance(goal.get("domain"), dict) else {}
        sub_title = clean_text(subdomain.get("title") or "")
        domain_title = clean_text(domain.get("title") or "")
        if sub_title:
            return sub_title
        return domain_title

    def leerjaar_route_for(self, goal: dict[str, Any]) -> str:
        age_range = goal.get("ageRange")
        if isinstance(age_range, dict):
            title = clean_text(age_range.get("title") or "")
            if title:
                return title
        return ""


class OpstapScraper:
    def __init__(
        self,
        *,
        output: Path = OUTPUT_PATH,
        headless: bool = True,
        timeout_ms: int = 90_000,
        dom_only: bool = False,
    ) -> None:
        self.output = output
        self.report_path = output.with_name("opstap_scrape_report.json")
        self.metadata_path = output.with_suffix(output.suffix + ".meta.json")
        self.headless = headless
        self.timeout_ms = timeout_ms
        self.dom_only = dom_only
        self.report = ScrapeReport()
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Leerkrachtentools-Opstap-scraper/1.0",
                "Accept": "application/json,text/html,*/*",
            }
        )

    async def run(self) -> None:
        if not self.dom_only:
            await self._verify_with_playwright()

        records: list[GoalRecord]
        if self.dom_only:
            self.report.strategy = "dom-fallback"
            records = await self._records_from_dom()
        else:
            self.report.strategy = "krcItems-api"
            records = self._records_from_api()

        if not records:
            raise ValueError("Geen Op.stap-doelen geëxtraheerd")

        records = self._dedupe(records)
        self._finalize_report(records)
        self._write_output(records)

    async def _verify_with_playwright(self) -> None:
        logger.info("Playwright: Op.stap laden en API-endpoints verifiëren …")
        captured: list[str] = []

        async def on_response(response: Response) -> None:
            content_type = (response.headers.get("content-type") or "").split(";")[0]
            if response.status == 200 and "json" in content_type:
                if "krcItems" in response.url or "snapshots" in response.url:
                    captured.append(response.url)

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=self.headless)
            page = await browser.new_page()
            page.on("response", on_response)
            response = await page.goto(
                BASE_URL + "/",
                wait_until="networkidle",
                timeout=self.timeout_ms,
            )
            if response is None or response.status != 200:
                status = response.status if response else "geen respons"
                raise RuntimeError(f"Op.stap niet bereikbaar (status {status})")

            title = await page.title()
            if "Op.stap" not in title:
                raise RuntimeError(f"Onverwachte paginatitel: {title!r}")

            await browser.close()

        self.report.json_endpoints = sorted(set(captured))
        if not self.report.json_endpoints:
            self.report.warn(
                "Playwright vond geen krcItems-respons; API-URL wordt hardcoded gebruikt."
            )

    def _fetch_krc_items(self) -> dict[str, Any]:
        logger.info("API ophalen: %s", KRC_ITEMS_URL)
        response = self.session.get(KRC_ITEMS_URL, timeout=180)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("krcItems-respons is geen JSON-object")
        return payload

    def _records_from_api(self) -> list[GoalRecord]:
        graph = OpstapGraph(self._fetch_krc_items())
        cache = MinimumGoalCache(self.session, self.report)
        records: list[GoalRecord] = []

        for goal in graph.goals:
            code = clean_text(str(goal.get("identifier") or ""))
            titel = clean_text(goal.get("title") or "")
            if not code or not titel:
                continue

            discipline_ref = goal.get("discipline")
            discipline = ""
            if isinstance(discipline_ref, dict):
                discipline = clean_text(discipline_ref.get("title") or "")

            minimum = MinimumGoal()
            minimum_paths = goal.get("minimumGoals") or []
            if isinstance(minimum_paths, list) and minimum_paths:
                first = str(minimum_paths[0])
                minimum = cache.get(first)

            records.append(
                GoalRecord(
                    code=code,
                    discipline=discipline,
                    subdomein=graph.subdomein_for(goal),
                    titel=titel,
                    leerjaar_route=graph.leerjaar_route_for(goal),
                    toelichting=clean_text(goal.get("description") or ""),
                    gelinkt_minimumdoel=minimum,
                )
            )

        logger.info(
            "API: %s doelen; %s unieke minimumdoelen opgehaald",
            len(records),
            len(cache._cache),
        )
        return records

    async def _records_from_dom(self) -> list[GoalRecord]:
        logger.warning("DOM-fallback is beperkt; gebruik bij voorkeur de API-modus.")
        records: list[GoalRecord] = []

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=self.headless)
            page = await browser.new_page()
            await page.goto(BASE_URL + "/", wait_until="networkidle", timeout=self.timeout_ms)
            await page.wait_for_timeout(3000)

            # Probeer doelen uit shadow DOM te lezen (structuur kan wijzigen).
            raw = await page.evaluate(
                """() => {
                    const root = document.querySelector('op-stap-selector')?.shadowRoot;
                    if (!root) return [];
                    const texts = [];
                    root.querySelectorAll('[data-goal-code], .goal, [class*="goal"]').forEach(el => {
                        texts.push({
                            code: el.getAttribute('data-goal-code') || '',
                            text: (el.textContent || '').trim().slice(0, 500)
                        });
                    });
                    return texts;
                }"""
            )
            await browser.close()

        for item in raw or []:
            code = clean_text(item.get("code") or "")
            titel = clean_text(item.get("text") or "")
            if code and titel:
                records.append(
                    GoalRecord(
                        code=code,
                        discipline="",
                        subdomein="",
                        titel=titel,
                        leerjaar_route="",
                        toelichting="",
                        gelinkt_minimumdoel=MinimumGoal(),
                    )
                )

        if not records:
            self.report.warn("DOM-fallback leverde geen doelen op.")
        return records

    @staticmethod
    def _dedupe(records: list[GoalRecord]) -> list[GoalRecord]:
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
        self.report.disciplines = dict(
            sorted(Counter(r.discipline for r in records if r.discipline).items())
        )

    def _write_output(self, records: list[GoalRecord]) -> None:
        self.output.parent.mkdir(parents=True, exist_ok=True)
        with self.output.open("w", encoding="utf-8") as handle:
            for record in records:
                handle.write(json.dumps(record.as_dict(), ensure_ascii=False) + "\n")

        metadata = {
            "network": "OPSTAP",
            "onderwijsniveau": "basisonderwijs",
            "brontitel": "Op.stap - leerroutes voor iedereen",
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
        logger.info("Rapport opgeslagen: %s", self.report_path)
        logger.info("Eindresultaat: %s unieke doelen", self.report.unique_goals)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Exporteer Op.stap naar JSONL."
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
        help="Sla de krcItems-API over en probeer DOM-extractie.",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Toon Chromium tijdens Playwright-verificatie.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=90,
        help="Timeout per browseractie in seconden (standaard: 90).",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


async def async_main(args: argparse.Namespace) -> int:
    scraper = OpstapScraper(
        output=args.output,
        headless=not args.headed,
        timeout_ms=args.timeout * 1_000,
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
        logger.exception("Op.stap-scrape mislukt")
        return 1


if __name__ == "__main__":
    sys.exit(main())
