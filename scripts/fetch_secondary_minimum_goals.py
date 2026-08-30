#!/usr/bin/env python3
"""
Haal officiële minimumdoelen/eindtermen secundair onderwijs op via de
Onderwijsdoelen 1.0-API van de Vlaamse overheid.

De API vereist een gratis publieke API-key:
https://onderwijs-api-portaal.vlaanderen.be/node/126

Gebruik:
  export ONDERWIJSDOELEN_API_KEY=...
  python3 scripts/fetch_secondary_minimum_goals.py

API-installaties kunnen andere parameter- of endpointnamen gebruiken. Die zijn
configureerbaar zonder codewijziging:
  ONDERWIJSDOELEN_API_BASE=https://...
  ONDERWIJSDOELEN_API_PATH=/v1/onderwijsdoelen/doelen
  python3 scripts/fetch_secondary_minimum_goals.py \
    --filter onderwijsniveau=\"secundair onderwijs\"
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin

import requests

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data/secundair/minimumdoelen_secundair.jsonl"
REPORT_PATH = OUTPUT_PATH.with_name("minimumdoelen_secundair_report.json")
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


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def first_value(record: dict[str, Any], keys: Iterable[str]) -> Any:
    lowered = {str(key).casefold(): value for key, value in record.items()}
    for key in keys:
        value = lowered.get(key.casefold())
        if value not in (None, "", []):
            return value
    return None


def walk_objects(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            yield from walk_objects(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from walk_objects(nested)


def normalize_goal(record: dict[str, Any]) -> dict[str, Any] | None:
    code = clean_text(
        first_value(
            record,
            (
                "uniqueCode",
                "uniekeCode",
                "code",
                "nummer",
                "onderwijsdoelCode",
            ),
        )
    )
    text = clean_text(
        first_value(
            record,
            (
                "title",
                "titel",
                "omschrijving",
                "tekst",
                "doelzin",
                "onderwijsdoel",
            ),
        )
    )
    if not code or len(text) < 12:
        return None

    level = clean_text(
        first_value(record, ("onderwijsniveau", "niveau", "educationLevel"))
    )
    combined = f"{level} {clean_text(record)}".casefold()
    if level and "secundair" not in combined:
        return None

    goal_type = clean_text(
        first_value(
            record,
            ("type", "doeltype", "onderwijsdoeltype", "goalType"),
        )
    )
    grade = clean_text(first_value(record, ("graad", "grade", "graadNaam")))
    finality = clean_text(
        first_value(record, ("finaliteit", "finality", "finaliteitNaam"))
    )
    stream = clean_text(first_value(record, ("stroom", "stream")))
    key_competence = clean_text(
        first_value(
            record,
            ("sleutelcompetentie", "keyCompetence", "competentie"),
        )
    )
    source_url = clean_text(
        first_value(record, ("url", "sourceUrl", "bronUrl", "detailUrl"))
    )

    return {
        "code": "",
        "discipline": key_competence,
        "subdomein": goal_type,
        "titel": "",
        "toelichting": "",
        "leerjaar_route": " · ".join(
            value for value in (grade, finality, stream) if value
        ),
        "onderwijsniveau": "secundair onderwijs",
        "graad": grade,
        "finaliteit": finality,
        "stroom": stream,
        "gelinkt_minimumdoel": {
            "code": code,
            "tekst": text,
            "type": goal_type or "Onderwijsdoel secundair onderwijs",
        },
        "netwerk": "VLAANDEREN",
        "bron_url": source_url or "https://www.onderwijsdoelen.be/",
    }


def extract_goals(payloads: Iterable[Any]) -> list[dict[str, Any]]:
    unique: dict[tuple[str, str], dict[str, Any]] = {}
    for payload in payloads:
        for record in walk_objects(payload):
            normalized = normalize_goal(record)
            if not normalized:
                continue
            minimum = normalized["gelinkt_minimumdoel"]
            unique.setdefault((minimum["code"], minimum["tekst"]), normalized)
    return list(unique.values())


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

        goals = extract_goals(payloads)
        if not goals:
            raise RuntimeError(
                "De API gaf geen herkenbare secundaire onderwijsdoelen terug. "
                "Controleer endpoint en filters via de officiële Swagger."
            )
        self._write(goals, len(payloads))
        return goals

    def _write(self, goals: list[dict[str, Any]], pages: int) -> None:
        self.output.parent.mkdir(parents=True, exist_ok=True)
        with self.output.open("w", encoding="utf-8") as handle:
            for goal in goals:
                handle.write(json.dumps(goal, ensure_ascii=False) + "\n")

        type_counts = Counter(
            goal["gelinkt_minimumdoel"]["type"] for goal in goals
        )
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "api_url": self.api_url,
            "filters": self.filters,
            "pages": pages,
            "record_count": len(goals),
            "type_counts": dict(type_counts),
            "source": "Onderwijsdoelen 1.0 - Vlaamse overheid",
        }
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch officiële secundaire minimumdoelen via de Vlaamse API."
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
    if not api_key:
        logger.error(
            "ONDERWIJSDOELEN_API_KEY ontbreekt. Vraag een gratis publieke key "
            "aan via https://onderwijs-api-portaal.vlaanderen.be/node/126"
        )
        return 2
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
    except KeyboardInterrupt:
        return 130
    except Exception:
        logger.exception("Minimumdoelen-fetch mislukt")
        return 1


if __name__ == "__main__":
    sys.exit(main())
