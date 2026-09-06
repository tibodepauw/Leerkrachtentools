#!/usr/bin/env python3
"""
Volledige curriculum-fetch voor alle Vlaamse onderwijsdomeinen.

Stappen:
  1. Basisonderwijs Op.stap (leerplandoelen + gekoppelde AHOVOKS-minimumdoelen)
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

from curriculum_deps import (
    ensure_curriculum_python_deps,
    ensure_playwright_chromium,
)
from local_env import load_local_env

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
    load_local_env(ROOT)

    deps = ensure_curriculum_python_deps(python)
    if deps != 0:
        return deps
    browser = ensure_playwright_chromium(python)
    if browser != 0:
        logging.warning(
            "Playwright Chromium kon niet worden geïnstalleerd (exit %s). "
            "Portaal-fallback werkt dan niet.",
            browser,
        )

    api_key = os.environ.get("ONDERWIJSDOELEN_API_KEY", "").strip()
    if not api_key:
        logging.warning(
            "ONDERWIJSDOELEN_API_KEY ontbreekt in .env.local. "
            "OKAN/BuBaO/... gebruikt het publieke portaal (Playwright). "
            "BuBaO zit niet in die portalsets."
        )

    failures = 0

    if not args.domains_only and not args.skip_secundair:
        failures += run_step(
            "Secundair (leerplannen + minimumdoelen + GCS)",
            [python, str(SCRIPTS / "fetch_secundair_full.py"), "--skip-pov"],
        )

    failures += run_step(
        "Op.stap leerplandoelen + AHOVOKS-minimumdoelen basisonderwijs",
        [python, str(SCRIPTS / "scrape_opstap_full.py"), "--skip-playwright"],
    )

    failures += run_step(
        "Alle onderwijsdoelen-domeinen (OKAN t/m HO)",
        [python, str(SCRIPTS / "fetch_onderwijsdoelen_domains.py")],
    )

    print("\n=== Volledige fetch samenvatting ===")
    print(f"  Fouten: {failures}")
    print("  Basisonderwijs Op.stap: data/opstap/")
  print("  Domeinen: data/{okan,bubao,buso,dko,volwassenen,hoger}/")
    print("  Secundair: data/secundair/")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
