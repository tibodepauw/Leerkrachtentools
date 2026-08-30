#!/usr/bin/env python3
"""
Haal in één run alle secundaire leerplannen en minimumdoelen op.

Stappen:
  1. GO!, KOV en OVSG leerplannen (PDF/Word)
  2. Vlaamse minimumdoelen (API-key of publiek portaal)
  3. POV leerplannen (POV_API_KEY optioneel)

Gebruik:
  python3 scripts/fetch_secundair_full.py
  python3 scripts/fetch_secundair_full.py --skip-pov
  python3 scripts/fetch_secundair_full.py --curriculum-only
"""

from __future__ import annotations

import argparse
import logging
import os
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
    parser = argparse.ArgumentParser(
        description="Batch-fetch alle secundaire curriculum- en minimumdoelendata."
    )
    parser.add_argument(
        "--skip-curriculum",
        action="store_true",
        help="Sla GO/KOV/OVSG leerplan-scrape over.",
    )
    parser.add_argument(
        "--skip-minimum",
        action="store_true",
        help="Sla Vlaamse minimumdoelen over.",
    )
    parser.add_argument(
        "--skip-pov",
        action="store_true",
        help="Sla POV API-fetch over.",
    )
    parser.add_argument(
        "--curriculum-only",
        action="store_true",
        help="Alleen leerplannen (geen minimumdoelen, geen POV).",
    )
    parser.add_argument(
        "--portal-only",
        action="store_true",
        help="Gebruik enkel het publieke portaal voor minimumdoelen.",
    )
    parser.add_argument(
        "--export-zip",
        action="store_true",
        help="Maak na afloop dist/secundair_update.zip (Windows-compatibel).",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    python = sys.executable
    failures = 0

    if not args.skip_curriculum:
        failures += run_step(
            "Secundaire leerplannen (GO!, KOV, OVSG)",
            [python, str(SCRIPTS / "scrape_secondary_curricula.py")],
        )

    if not args.skip_minimum and not args.curriculum_only:
        minimum_cmd = [python, str(SCRIPTS / "fetch_secondary_minimum_goals.py")]
        if args.portal_only:
            minimum_cmd.append("--portal-only")
        failures += run_step("Vlaamse minimumdoelen secundair", minimum_cmd)

    if (
        not args.skip_pov
        and not args.curriculum_only
        and os.environ.get("POV_API_KEY", "").strip()
    ):
        failures += run_step(
            "POV secundaire leerplannen",
            [python, str(SCRIPTS / "fetch_pov_secondary_curricula.py")],
        )
    elif not args.skip_pov and not args.curriculum_only:
        logging.warning(
            "POV_API_KEY niet gezet - POV leerplannen overgeslagen. "
            "Registreer een gratis key via https://pov.classid.io/website/sapo-endpoints"
        )

    print("\n=== Secundair batch-resultaat ===")
    print(f"  Fouten: {failures}")
    print("  Leerplannen: data/secundair/leerplannen_secundair.jsonl")
    print("  Minimumdoelen: data/secundair/minimumdoelen_secundair.jsonl")
    print("  POV: data/secundair/leerplannen_pov_secundair.jsonl")

    export_gcs_script = SCRIPTS / "export_secundair_gcs.py"
    gcs_code = run_step(
        "Discovery Engine .txt-export (data/secundair/gcs/)",
        [python, str(export_gcs_script)],
    )
    failures += gcs_code
    if gcs_code == 0:
        print("  GCS-export: data/secundair/gcs/")

    if args.export_zip:
        export_script = SCRIPTS / "export_secundair_zip.py"
        export_code = run_step(
            "Windows-compatibele zip-export",
            [python, str(export_script)],
        )
        failures += export_code
        if export_code == 0:
            print("  Zip: dist/secundair_update.zip")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
