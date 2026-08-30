#!/usr/bin/env python3
"""
Haal secundaire minimumdoelen op via het publieke onderwijsdoelen.be-portaal.

Geen ONDERWIJSDOELEN_API_KEY nodig: de Angular-site laadt doelen rechtstreeks
via https://onderwijs.api.vlaanderen.be/onderwijsdoelen/ zolang het verzoek
vanuit een browsercontext komt (robots.txt staat /doelen toe).

Gebruik:
  python3 scripts/scrape_onderwijsdoelen_portal.py
  python3 scripts/scrape_onderwijsdoelen_portal.py --dataset SO_1STE_GRAAD_V2_1
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from secondary_minimum_goals_common import extract_portal_goals

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data/secundair/minimumdoelen_secundair.jsonl"
PORTAL_BASE = "https://www.onderwijsdoelen.be/doelen"
SECONDARY_DATASETS = (
    "SO_1STE_GRAAD_V2_1",
    "SO_2DE_GRAAD_V2_1",
    "SO_3DE_GRAAD_V2_1",
    "SO_3DE_GRAAD_3DE_LEERJAAR_V2_1",
)

logger = logging.getLogger("scrape_onderwijsdoelen_portal")


class PortalMinimumGoalsScraper:
    def __init__(
        self,
        *,
        output: Path = OUTPUT_PATH,
        datasets: tuple[str, ...] = SECONDARY_DATASETS,
        timeout_ms: int = 120_000,
    ) -> None:
        self.output = output
        self.report_path = output.with_name("minimumdoelen_secundair_report.json")
        self.datasets = datasets
        self.timeout_ms = timeout_ms

    def run(self) -> list[dict[str, Any]]:
        raw_records = asyncio.run(self._collect_records())
        goals = extract_portal_goals(raw_records)
        if not goals:
            raise RuntimeError(
                "Geen secundaire minimumdoelen gevonden via onderwijsdoelen.be."
            )
        self._write(goals, len(raw_records))
        return goals

    async def _collect_records(self) -> list[dict[str, Any]]:
        try:
            from playwright.async_api import async_playwright
        except ImportError as exc:
            raise RuntimeError(
                "Playwright ontbreekt. Installeer met: "
                "pip install -r scripts/requirements-curriculum.txt && "
                "playwright install chromium"
            ) from exc

        collected: list[dict[str, Any]] = []
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            page = await browser.new_page()

            for dataset in self.datasets:
                url = f"{PORTAL_BASE}/{dataset}"
                logger.info("Portaal laden: %s", url)
                before = len(collected)

                async def on_response(response, *, dataset=dataset) -> None:
                    if not response.url.startswith(
                        "https://onderwijs.api.vlaanderen.be/onderwijsdoelen/onderwijsdoel?"
                    ):
                        return
                    if response.status != 200:
                        return
                    payload = await response.json()
                    members = payload.get("gegevens", {}).get("member", [])
                    if not isinstance(members, list):
                        return
                    for member in members:
                        if isinstance(member, dict):
                            tagged = dict(member)
                            tagged["_dataset"] = dataset
                            collected.append(tagged)

                page.on("response", on_response)
                await page.goto(url, wait_until="networkidle", timeout=self.timeout_ms)
                await page.wait_for_timeout(1500)
                page.remove_listener("response", on_response)
                logger.info("  → %s ruwe doelen", len(collected) - before)

            await browser.close()

        return collected

    def _write(self, goals: list[dict[str, Any]], raw_count: int) -> None:
        self.output.parent.mkdir(parents=True, exist_ok=True)
        with self.output.open("w", encoding="utf-8") as handle:
            for goal in goals:
                handle.write(json.dumps(goal, ensure_ascii=False) + "\n")

        sc_counts = Counter(goal.get("discipline") or "?" for goal in goals)
        grade_counts = Counter(goal.get("graad") or "?" for goal in goals)
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "onderwijsdoelen.be portaal (publiek, geen API-key)",
            "datasets": list(self.datasets),
            "raw_record_count": raw_count,
            "record_count": len(goals),
            "grade_counts": dict(grade_counts),
            "sleutelcompetentie_counts": dict(sc_counts),
        }
        self.report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        logger.info("JSONL: %s (%s doelen)", self.output, len(goals))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape secundaire minimumdoelen via onderwijsdoelen.be."
    )
    parser.add_argument(
        "--dataset",
        nargs="+",
        choices=SECONDARY_DATASETS,
        default=list(SECONDARY_DATASETS),
    )
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--timeout-ms", type=int, default=120_000)
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    try:
        PortalMinimumGoalsScraper(
            output=args.output,
            datasets=tuple(args.dataset),
            timeout_ms=args.timeout_ms,
        ).run()
        return 0
    except KeyboardInterrupt:
        return 130
    except Exception:
        logger.exception("Portaalscrape mislukt")
        return 1


if __name__ == "__main__":
    sys.exit(main())
