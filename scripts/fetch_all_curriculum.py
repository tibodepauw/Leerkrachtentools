#!/usr/bin/env python3
"""
Volledige curriculum-fetch voor alle Vlaamse onderwijsdomeinen.

Stappen:
  1. Basisonderwijs corpus (optioneel, bestaande scripts)
  2. Secundair (leerplannen + minimumdoelen)
  3. OKAN, BuBaO, BuSO, DKO, Volwassenen, Hoger (Onderwijsdoelen API)

Gebruik:
  npm run fetch:all
  python3 scripts/fetch_all_curriculum.py --domains-only
"""

from __future__ import annotations

import argparse
import logging
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent


def run_step(label: str, command: list[str]) -> int:
    logging.info("Start: %s", label)
    result = subprocess.run(command, cwd=ROOT)
    if result.returncode != 0:
        logging.error("Mislukt: %s (exit %s)", label, result.returncode)
    else:
        logging.info("Klaar: %s", label)
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch-fetch alle curriculumdata.")
    parser.add_argument(
        "--domains-only",
        action="store_true",
        help="Alleen OKAN/BuBaO/BuSO/DKO/VO/HO (geen secundair).",
    )
    parser.add_argument(
        "--skip-secundair",
        action="store_true",
        help="Sla secundaire scrape over.",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    python = sys.executable
    failures = 0

    if not args.domains_only and not args.skip_secundair:
        failures += run_step(
            "Secundair (leerplannen + minimumdoelen + GCS)",
            [python, str(SCRIPTS / "fetch_secundair_full.py"), "--skip-pov"],
        )

    failures += run_step(
        "Alle onderwijsdoelen-domeinen (OKAN t/m HO)",
        [python, str(SCRIPTS / "fetch_onderwijsdoelen_domains.py")],
    )

    print("\n=== Volledige fetch samenvatting ===")
    print(f"  Fouten: {failures}")
    print("  Domeinen: data/{okan,bubao,buso,dko,volwassenen,hoger}/")
    print("  Secundair: data/secundair/")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
