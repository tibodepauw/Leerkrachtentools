#!/usr/bin/env python3
"""
Haal officiële leerplan- en minimumdoelenbronnen op voor Vertex AI Search / GCS.

Voorbeeld:
    pip install -r scripts/requirements-curriculum.txt
    python scripts/fetch_curriculum_data.py
    python scripts/fetch_curriculum_data.py --network ZILL GO --data-dir ./data
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from curriculum_fetch.config import DEFAULT_DATA_DIR, NETWORKS, OFFICIAL_OVERVIEW_URLS
from curriculum_fetch.downloader import CurriculumDownloader
from curriculum_fetch.sources import (
    GoFetcher,
    MinimumdoelenFetcher,
    OvsgFetcher,
    ZillFetcher,
)

FETCHERS = {
    "ZILL": ZillFetcher,
    "GO": GoFetcher,
    "OVSG": OvsgFetcher,
    "MINIMUMDOELEN": MinimumdoelenFetcher,
}


def configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
        datefmt="%H:%M:%S",
    )


def print_overview_urls() -> None:
    print("\n=== Officiële overzichts- en downloadpagina's ===\n")
    for network in NETWORKS:
        print(f"## {network}")
        for entry in OFFICIAL_OVERVIEW_URLS[network]:
            print(f"  - {entry['titel']}")
            print(f"    {entry['url']}")
            if entry.get("opmerking"):
                print(f"    ({entry['opmerking']})")
        print()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download officiële leerplan- en minimumdoelenbronnen (Vlaams basisonderwijs)."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help=f"Doelmap voor downloads (standaard: {DEFAULT_DATA_DIR})",
    )
    parser.add_argument(
        "--network",
        nargs="+",
        choices=NETWORKS,
        default=list(NETWORKS),
        help="Welke netwerken ophalen (standaard: alle vier)",
    )
    parser.add_argument(
        "--list-urls",
        action="store_true",
        help="Toon officiële bron-URL's en stop",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Debug-logging",
    )
    args = parser.parse_args()

    configure_logging(args.verbose)

    if args.list_urls:
        print_overview_urls()
        return 0

    downloader = CurriculumDownloader(args.data_dir)
    totals: dict[str, int] = {}

    for network in args.network:
        fetcher_cls = FETCHERS[network]
        fetcher = fetcher_cls(downloader)
        logging.info("Start ophalen: %s", network)
        totals[network] = fetcher.fetch()

    print("\n=== Resultaat ===")
    for network, count in totals.items():
        folder = {
            "ZILL": "zill",
            "GO": "go",
            "OVSG": "ovsg",
            "MINIMUMDOELEN": "minimumdoelen",
        }[network]
        print(f"  {network}: {count} bestand(en) → {args.data_dir / folder}")

    print("\nZie docs/curriculum-bronnen-urls.md voor het volledige URL-overzicht.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
