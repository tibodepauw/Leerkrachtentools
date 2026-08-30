#!/usr/bin/env python3
"""
Haal officiële minimumdoelen/eindtermen secundair onderwijs op.

Volgorde:
  1. Onderwijsdoelen 1.0-API (ONDERWIJSDOELEN_API_KEY) indien beschikbaar
  2. Publiek onderwijsdoelen.be-portaal via Playwright (geen API-key nodig)

Gebruik:
  python3 scripts/fetch_secondary_minimum_goals.py
  python3 scripts/fetch_secondary_minimum_goals.py --portal-only
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests

from secondary_minimum_goals_common import extract_api_goals, first_value

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data/secundair/minimumdoelen_secundair.jsonl"
DEFAULT_API_BASE = os.environ.get(
    "ONDERWIJSDOELEN_API_BASE",
    "https://onderwijs-vlaanderen-portaalov.apigee.io",
)
DEFAULT_API_PATH = os.environ.get(
    "ONDERWIJSDOELEN_API_PATH",
    "/v1/onderwijsdoelen/doelen",
)
DEFAULT_FILTERS = {"onderwijsniveau": "secundair onderwijs"}
USER_AGENT = (
    "Leerkrachtentools-secondary-minimum-goals/1.0 "
    "(publieke onderwijsdata; https://github.com/tibodepauw/Leerkrachtentools)"
)

logger = logging.getLogger("fetch_secondary_minimum_goals")


def next_url(payload: Any, current_url: str) -> str | None:
    if not isinstance(payload, dict):
        return None
    candidate = first_value(payload, ("next", "nextPage", "volgende", "nextUrl"))
    if isinstance(candidate, dict):
        candidate = first_value(candidate, ("href", "url"))
    if isinstance(candidate, str) and candidate.strip():
        return urljoin(current_url, candidate)
    links = payload.get("links") or payload.get("_links")
    if isinstance(links, dict):
        candidate = links.get("next")
        if isinstance(candidate, dict):
            candidate = candidate.get("href")
        if isinstance(candidate, str) and candidate.strip():
            return urljoin(current_url, candidate)
    return None


class SecondaryMinimumGoalsFetcher:
    def __init__(
        self,
        *,
        api_key: str,
        api_url: str,
        filters: dict[str, str],
        output: Path = OUTPUT_PATH,
        timeout: int = 60,
        max_pages: int = 100,
    ) -> None:
        self.api_key = api_key
        self.api_url = api_url
        self.filters = filters
        self.output = output
        self.report_path = output.with_name("minimumdoelen_secundair_report.json")
        self.timeout = timeout
        self.max_pages = max_pages
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
                "apikey": api_key,
            }
        )

    def run(self) -> list[dict[str, Any]]:
        payloads: list[Any] = []
        url: str | None = self.api_url
        params: dict[str, str] | None = self.filters
        visited: set[str] = set()

        while url and len(payloads) < self.max_pages and url not in visited:
            logger.info("API-pagina %s: %s", len(payloads) + 1, url)
            visited.add(url)
            response = self.session.get(
                url,
                params=params,
                timeout=self.timeout,
            )
            if response.status_code in (401, 403):
                raise RuntimeError(
                    "Onderwijsdoelen-API weigert de API-key. Vraag toegang aan "
                    "via onderwijs-api-portaal.vlaanderen.be."
                )
            response.raise_for_status()
            payload = response.json()
            payloads.append(payload)
            url = next_url(payload, response.url)
            params = None

        goals = extract_api_goals(payloads)
        if not goals:
            raise RuntimeError(
                "De API gaf geen herkenbare secundaire onderwijsdoelen terug. "
                "Controleer endpoint en filters via de officiële Swagger."
            )
        self._write(
            goals,
            len(payloads),
            source="Onderwijsdoelen 1.0 - Vlaamse overheid (API-key)",
        )
        return goals

    def _write(
        self,
        goals: list[dict[str, Any]],
        pages: int,
        *,
        source: str,
        extra: dict[str, Any] | None = None,
    ) -> None:
        self.output.parent.mkdir(parents=True, exist_ok=True)
        with self.output.open("w", encoding="utf-8") as handle:
            for goal in goals:
                handle.write(json.dumps(goal, ensure_ascii=False) + "\n")

        type_counts = Counter(
            goal["gelinkt_minimumdoel"]["type"] for goal in goals
        )
        sc_counts = Counter(goal.get("sleutelcompetentie_nr") or "?" for goal in goals)
        grade_counts = Counter(goal.get("graad") or "?" for goal in goals)
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "api_url": self.api_url,
            "filters": self.filters,
            "pages": pages,
            "record_count": len(goals),
            "type_counts": dict(type_counts),
            "grade_counts": dict(grade_counts),
            "sleutelcompetentie_counts": dict(sc_counts),
            "source": source,
        }
        if extra:
            report.update(extra)
        self.report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        logger.info("JSONL: %s (%s doelen)", self.output, len(goals))


def parse_filter(values: list[str]) -> dict[str, str]:
    filters = dict(DEFAULT_FILTERS)
    for value in values:
        if "=" not in value:
            raise ValueError(f"Filter moet sleutel=waarde zijn: {value}")
        key, item = value.split("=", 1)
        if not key.strip() or not item.strip():
            raise ValueError(f"Ongeldige filter: {value}")
        filters[key.strip()] = item.strip()
    return filters


def fetch_with_portal(output: Path) -> list[dict[str, Any]]:
    from scrape_onderwijsdoelen_portal import PortalMinimumGoalsScraper

    logger.info(
        "Geen API-key: fallback naar publiek onderwijsdoelen.be-portaal."
    )
    return PortalMinimumGoalsScraper(output=output).run()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch officiële secundaire minimumdoelen."
    )
    parser.add_argument(
        "--api-url",
        default=DEFAULT_API_BASE.rstrip("/") + DEFAULT_API_PATH,
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("ONDERWIJSDOELEN_API_KEY", ""),
    )
    parser.add_argument(
        "--filter",
        action="append",
        default=[],
        help="API-filter sleutel=waarde (herhaalbaar)",
    )
    parser.add_argument(
        "--portal-only",
        action="store_true",
        help="Sla API over en gebruik enkel het publieke portaal.",
    )
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--max-pages", type=int, default=100)
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    api_key = args.api_key.strip()

    try:
        if args.portal_only or not api_key:
            fetch_with_portal(args.output)
            return 0

        try:
            SecondaryMinimumGoalsFetcher(
                api_key=api_key,
                api_url=args.api_url,
                filters=parse_filter(args.filter),
                output=args.output,
                timeout=args.timeout,
                max_pages=args.max_pages,
            ).run()
            return 0
        except Exception as exc:
            logger.warning("API-fetch mislukt (%s), val terug op portaal.", exc)
            fetch_with_portal(args.output)
            return 0
    except KeyboardInterrupt:
        return 130
    except Exception:
        logger.exception("Minimumdoelen-fetch mislukt")
        return 1


if __name__ == "__main__":
    sys.exit(main())
