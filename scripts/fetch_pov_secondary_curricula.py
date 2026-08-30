#!/usr/bin/env python3
"""
Haal leerplandoelen van Provinciaal Onderwijs Vlaanderen op via de officiële
Doelenverdeler-API.

API-documentatie:
https://pov.classid.io/website/sapo-endpoints

Gebruik:
  export POV_API_KEY=...
  python3 scripts/fetch_pov_secondary_curricula.py
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

import requests

from secondary_record_schema import normalize_curriculum_record

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data/secundair/leerplannen_pov_secundair.jsonl"
API_BASE = "https://classid.io/api/leerplannen"
DOCS_URL = "https://pov.classid.io/website/sapo-endpoints"
USER_AGENT = (
    "Leerkrachtentools-POV-curriculum/1.0 "
    "(publieke onderwijsdata; https://github.com/tibodepauw/Leerkrachtentools)"
)

logger = logging.getLogger("fetch_pov_secondary_curricula")


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def first_value(record: dict[str, Any], keys: Iterable[str]) -> Any:
    lowered = {str(key).casefold(): value for key, value in record.items()}
    for key in keys:
        value = lowered.get(key.casefold())
        if value not in (None, "", []):
            return value
    return None


def object_list(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("data", "items", "results", "leerplannen", "doelen"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        return [payload]
    return []


def infer_route(value: str) -> tuple[str, str, str]:
    lowered = value.casefold()
    grade = next(
        (
            label
            for pattern, label in (
                (r"\b(?:1ste|eerste)\s+graad\b", "1ste graad"),
                (r"\b(?:2de|tweede)\s+graad\b", "2de graad"),
                (r"\b(?:3de|derde)\s+graad\b", "3de graad"),
                (r"\b(?:7de|zevende)\s+(?:jaar|leerjaar)\b", "7de leerjaar"),
            )
            if re.search(pattern, lowered)
        ),
        "",
    )
    finality = next(
        (
            label
            for token, label in (
                ("dubbele finaliteit", "dubbele finaliteit"),
                ("doorstroomfinaliteit", "doorstroomfinaliteit"),
                ("arbeidsmarktfinaliteit", "arbeidsmarktfinaliteit"),
            )
            if token in lowered
        ),
        "",
    )
    stream = next(
        (label for label in ("A-stroom", "B-stroom") if label.casefold() in lowered),
        "",
    )
    return grade, finality, stream


def normalize_pov_goal(
    goal: dict[str, Any],
    curriculum: dict[str, Any],
) -> dict[str, Any] | None:
    code = clean_text(
        first_value(goal, ("code", "nummer", "doelcode", "identifier"))
    )
    title = clean_text(
        first_value(
            goal,
            ("titel", "title", "doel", "doelzin", "omschrijving", "tekst"),
        )
    )
    if not code or len(title) < 8:
        return None

    curriculum_title = clean_text(
        first_value(curriculum, ("naam", "name", "titel", "title"))
    )
    route_text = " ".join(
        clean_text(value)
        for value in (
            curriculum_title,
            first_value(curriculum, ("graad", "finaliteit", "onderwijstype")),
            first_value(goal, ("graad", "finaliteit", "onderwijstype")),
        )
        if value
    )
    grade, finality, stream = infer_route(route_text)
    discipline = clean_text(
        first_value(
            goal,
            ("vak", "discipline", "sleutelcompetentie", "leergebied"),
        )
        or first_value(curriculum, ("vak", "discipline", "leergebied"))
        or curriculum_title
    )

    return normalize_curriculum_record(
        {
            "code": code,
            "titel": title,
            "discipline": discipline,
            "toelichting": clean_text(
                first_value(goal, ("toelichting", "description", "wenk"))
            ),
            "graad": grade,
            "finaliteit": finality,
            "stroom": stream,
            "netwerk": "POV",
            "bron_url": DOCS_URL,
        }
    )


class PovCurriculumFetcher:
    def __init__(
        self,
        *,
        api_key: str,
        output: Path = OUTPUT_PATH,
        timeout: int = 60,
        limit: int | None = None,
    ) -> None:
        self.output = output
        self.report_path = output.with_name("leerplannen_pov_secundair_report.json")
        self.timeout = timeout
        self.limit = limit
        self.session = requests.Session()
        self.session.headers.update(
            {
                "api-key": api_key,
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
            }
        )

    def run(self) -> list[dict[str, Any]]:
        response = self.session.get(f"{API_BASE}/list", timeout=self.timeout)
        self._check_response(response)
        curricula = object_list(response.json())
        if self.limit is not None:
            curricula = curricula[: self.limit]

        records: list[dict[str, Any]] = []
        failed: list[str] = []
        for index, curriculum in enumerate(curricula, start=1):
            curriculum_id = clean_text(
                first_value(curriculum, ("id", "leerplanId", "uuid"))
            )
            if not curriculum_id:
                continue
            logger.info("[%s/%s] leerplan %s", index, len(curricula), curriculum_id)
            try:
                detail = self.session.get(
                    f"{API_BASE}/{curriculum_id}/detailed",
                    timeout=self.timeout,
                )
                self._check_response(detail)
                goals = object_list(detail.json())
                for goal in goals:
                    record = normalize_pov_goal(goal, curriculum)
                    if record:
                        records.append(record)
            except Exception as exc:
                failed.append(f"{curriculum_id}: {exc}")
                logger.warning("Leerplan %s mislukt: %s", curriculum_id, exc)

        unique = {
            (record["code"], record["discipline"], record["titel"]): record
            for record in records
        }
        records = list(unique.values())
        if not records:
            raise RuntimeError("POV API gaf geen herkenbare leerplandoelen terug.")
        self._write(records, len(curricula), failed)
        return records

    @staticmethod
    def _check_response(response: requests.Response) -> None:
        if response.status_code in (401, 403):
            raise RuntimeError(
                "POV API weigert de api-key. Vraag een sleutel aan via het "
                "registratieformulier op pov.classid.io."
            )
        response.raise_for_status()

    def _write(
        self,
        records: list[dict[str, Any]],
        curriculum_count: int,
        failed: list[str],
    ) -> None:
        self.output.parent.mkdir(parents=True, exist_ok=True)
        with self.output.open("w", encoding="utf-8") as handle:
            for record in records:
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "api": API_BASE,
            "documentation": DOCS_URL,
            "curriculum_count": curriculum_count,
            "record_count": len(records),
            "grade_counts": dict(Counter(record["graad"] for record in records)),
            "failed": failed,
        }
        self.report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        logger.info("JSONL: %s (%s doelen)", self.output, len(records))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch POV-leerplandoelen via de officiële Doelenverdeler-API."
    )
    parser.add_argument("--api-key", default=os.environ.get("POV_API_KEY", ""))
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--limit", type=int)
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    if not args.api_key.strip():
        logger.error(
            "POV_API_KEY ontbreekt. Vraag een sleutel aan via "
            "https://pov.classid.io/website/contact"
        )
        return 2
    try:
        PovCurriculumFetcher(
            api_key=args.api_key.strip(),
            output=args.output,
            timeout=args.timeout,
            limit=args.limit,
        ).run()
        return 0
    except KeyboardInterrupt:
        return 130
    except Exception:
        logger.exception("POV-fetch mislukt")
        return 1


if __name__ == "__main__":
    sys.exit(main())
