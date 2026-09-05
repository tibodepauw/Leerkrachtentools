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
import os
import subprocess
import sys
from pathlib import Path

from local_env import load_local_env

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent

SECUNDAIR_PACKAGES = (
    ("requests", "requests"),
    ("bs4", "beautifulsoup4"),
    ("docx", "python-docx"),
    ("pypdf", "pypdf"),
)


def missing_modules(packages: tuple[tuple[str, str], ...]) -> list[str]:
    missing: list[str] = []
    for module, pip_name in packages:
        try:
            __import__(module)
        except ImportError:
            missing.append(pip_name)
    return missing


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
    load_local_env(ROOT)

    if not args.domains_only and not args.skip_secundair:
        missing = missing_modules(SECUNDAIR_PACKAGES)
        if missing:
            logging.error(
                "Python-pakketten ontbreken: %s. Installeer ze eerst met "
                "`pip install -r scripts/requirements-curriculum.txt`.",
                ", ".join(missing),
            )
            return 1

    api_key = os.environ.get("ONDERWIJSDOELEN_API_KEY", "").strip()
    if not api_key:
        logging.error(
            "ONDERWIJSDOELEN_API_KEY ontbreekt. Zet de key in .env.local "
            "(zie .env.example) of exporteer die in je shell. "
            "Zonder key stopt de OKAN/BuBaO/BuSO/DKO-fetch."
        )
        return 1

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
