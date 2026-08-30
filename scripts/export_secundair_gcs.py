#!/usr/bin/env python3
"""
Exporteer secundaire JSONL naar leesbare .txt-bestanden voor Google Cloud Discovery Engine.

Uitvoer in data/secundair/gcs/:
  - leerplannen_secundair_kov.txt
  - leerplannen_secundair_go.txt
  - leerplannen_secundair_ovsg.txt
  - minimumdoelen_secundair.txt

Gebruik:
  python3 scripts/export_secundair_gcs.py
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from secondary_record_schema import export_secundair_gcs

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data" / "secundair"
DEFAULT_OUTPUT_DIR = DEFAULT_DATA_DIR / "gcs"

logger = logging.getLogger("export_secundair_gcs")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Exporteer secundaire corpus naar Discovery Engine .txt-bestanden."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help="Map met leerplannen_secundair.jsonl en minimumdoelen_secundair.jsonl",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Doelmap voor .txt-export (standaard: data/secundair/gcs)",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    counts = export_secundair_gcs(args.data_dir, args.output_dir)
    print(json.dumps({"output_dir": str(args.output_dir), "counts": counts}, indent=2))

    if not any(counts.values()):
        logger.warning(
            "Geen records geëxporteerd. Voer eerst fetch_secundair_full.py uit "
            "of plaats JSONL-bestanden in %s",
            args.data_dir,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
