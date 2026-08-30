#!/usr/bin/env python3
"""
Haal alle Vlaamse onderwijsdoelen op voor OKAN, BuBaO, BuSO, DKO, VO en HO.

Bronnen:
  - Onderwijsdoelen API (`ONDERWIJSDOELEN_API_KEY` in `.env.local`)
  - Optioneel: Playwright-portaaldatasets voor validatie

Uitvoer per domein in data/{domein}/:
  - onderwijsdoelen_{domein}.jsonl
  - gcs/onderwijsdoelen_{domein}.txt

Gebruik:
  python3 scripts/fetch_onderwijsdoelen_domains.py
  python3 scripts/fetch_onderwijsdoelen_domains.py --domain OKAN BUBAO
  python3 scripts/fetch_onderwijsdoelen_domains.py --portal-verify
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

from education_record_schema import export_all_domain_gcs
from onderwijsdoelen_api_client import (
    fetch_all_goals,
    fetch_portal_dataset,
    normalize_goals,
    write_jsonl,
)
from onderwijsdoelen_datasets import DATASET_TO_DOMAIN, DOMAIN_OUTPUT, PORTAL_DATASET_IDS

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "data"

logger = logging.getLogger("fetch_onderwijsdoelen_domains")

TARGET_DOMAINS = tuple(DOMAIN_OUTPUT.keys())


def split_by_domain(records: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    grouped: dict[str, list[dict[str, str]]] = {domain: [] for domain in TARGET_DOMAINS}
    for record in records:
        domain = record.get("onderwijsniveau", "")
        if domain in grouped:
            grouped[domain].append(record)
    return grouped


def write_domain_outputs(grouped: dict[str, list[dict[str, str]]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for domain, records in grouped.items():
        meta = DOMAIN_OUTPUT[domain]
        output = DATA_ROOT / meta["dir"] / meta["jsonl"]
        counts[domain] = write_jsonl(output, records)
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "domain": domain,
            "record_count": counts[domain],
            "grade_counts": dict(Counter(r.get("graad", "") for r in records)),
            "finaliteit_counts": dict(Counter(r.get("finaliteit", "") for r in records)),
            "discipline_top": dict(Counter(r.get("discipline", "") for r in records).most_common(20)),
            "source": "onderwijs.api.vlaanderen.be/onderwijsdoelen",
        }
        report_path = output.with_name(output.stem + "_report.json")
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        logger.info("JSONL %s: %s doelen", output, counts[domain])
    return counts


async def verify_portal_samples() -> dict[str, int]:
    sample_sets = [
        ds for ds in PORTAL_DATASET_IDS if DATASET_TO_DOMAIN.get(ds) in TARGET_DOMAINS
    ]
    counts: dict[str, int] = {}
    for dataset in sample_sets:
        raw = await fetch_portal_dataset(dataset)
        normalized = normalize_goals(raw, dataset=dataset)
        counts[dataset] = len(normalized)
        logger.info("Portaal %s: %s genormaliseerde doelen", dataset, len(normalized))
    return counts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Vlaamse onderwijsdoelen voor alle resterende domeinen."
    )
    parser.add_argument(
        "--domain",
        nargs="+",
        choices=TARGET_DOMAINS,
        default=list(TARGET_DOMAINS),
    )
    parser.add_argument(
        "--portal-verify",
        action="store_true",
        help="Valideer een subset via Playwright-portaaldatasets.",
    )
    parser.add_argument(
        "--skip-gcs",
        action="store_true",
        help="Sla GCS .txt-export over.",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    try:
        raw = fetch_all_goals()
        if not raw:
            raise RuntimeError("Geen doelen opgehaald via Onderwijsdoelen API.")

        normalized = normalize_goals(raw)
        grouped = split_by_domain(normalized)
        selected = set(args.domain)
        grouped = {k: v for k, v in grouped.items() if k in selected}

        counts = write_domain_outputs(grouped)

        if not args.skip_gcs:
            gcs_counts = export_all_domain_gcs(DATA_ROOT)
            logger.info("GCS-export: %s", gcs_counts)

        if args.portal_verify:
            portal_counts = asyncio.run(verify_portal_samples())
            logger.info("Portaalverificatie: %s", portal_counts)

        print("\n=== Onderwijsdoelen per domein ===")
        for domain, count in sorted(counts.items()):
            print(f"  {domain}: {count}")
        print(f"  Totaal API-ruw: {len(raw)}")
        print(f"  Totaal genormaliseerd: {len(normalized)}")
        return 0
    except KeyboardInterrupt:
        return 130
    except Exception:
        logger.exception("Fetch mislukt")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
