#!/usr/bin/env python3
"""
Maak een Windows-compatibele secundair-corpus zip voor handmatige installatie.

De ingebouwde Windows-zipwizard faalt vaak op archieven met Unix-permissies.
Dit script gebruikt `zip -X -j` indien beschikbaar, anders Python zipfile met
create_system=0 (MS-DOS).

Gebruik:
  python3 scripts/export_secundair_zip.py
  python3 scripts/export_secundair_zip.py --output ./secundair_update.zip

Bron: data/secundair/*.jsonl (prod) of test/fixtures/*-secundair.jsonl (fallback).
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "secundair"
FIXTURE_DIR = ROOT / "test" / "fixtures"
DEFAULT_OUTPUT = ROOT / "dist" / "secundair_update.zip"

CORPUS_FILES: tuple[tuple[str, str], ...] = (
    ("leerplannen_secundair.jsonl", "curriculum-secundair.jsonl"),
    ("minimumdoelen_secundair.jsonl", "minimumdoelen-secundair.jsonl"),
    ("leerplannen_pov_secundair.jsonl", "curriculum-pov-secundair.jsonl"),
)

README = """Secundair corpus update voor Leerkrachtentools
=========================================

1. Maak de map data/secundair aan in de projectroot (indien nodig).

2. Pak alle .jsonl-bestanden uit in data/secundair/
   (niet in een extra submap).

3. Herstart de app (npm run dev) zodat de nieuwe corpus geladen wordt.

Bestanden in dit archief:
  - leerplannen_secundair.jsonl   (GO!, KOV, OVSG leerplannen)
  - minimumdoelen_secundair.jsonl (Vlaamse minimumdoelen secundair)
  - leerplannen_pov_secundair.jsonl (optioneel, POV)

Genereer opnieuw met: python3 scripts/export_secundair_zip.py
"""


def resolve_source(prod_name: str, fixture_name: str) -> Path | None:
    prod = DATA_DIR / prod_name
    if prod.is_file() and prod.stat().st_size > 0:
        return prod
    fixture = FIXTURE_DIR / fixture_name
    if fixture.is_file() and fixture.stat().st_size > 0:
        return fixture
    return None


def collect_sources() -> list[tuple[Path, str]]:
    collected: list[tuple[Path, str]] = []
    for prod_name, fixture_name in CORPUS_FILES:
        source = resolve_source(prod_name, fixture_name)
        if source:
            collected.append((source, prod_name))
    return collected


def _normalize_arcname(name: str) -> str:
    normalized = name.replace("\\", "/").lstrip("/")
    if ".." in normalized.split("/"):
        raise ValueError(f"Ongeldige zip-entry: {name}")
    return normalized


def build_zip_python(output: Path, staged: list[tuple[Path, str]]) -> None:
    with zipfile.ZipFile(
        output,
        mode="w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=6,
        strict_timestamps=False,
    ) as zf:
        readme = zipfile.ZipInfo("LEESMIJ.txt")
        readme.compress_type = zipfile.ZIP_DEFLATED
        readme.create_system = 0
        readme.external_attr = 0
        readme.date_time = datetime.now(tz=timezone.utc).replace(tzinfo=None).timetuple()[:6]
        zf.writestr(readme, README.encode("utf-8"))

        for source, arcname in staged:
            info = zipfile.ZipInfo(_normalize_arcname(arcname))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 0
            info.external_attr = 0
            info.date_time = datetime.now(tz=timezone.utc).replace(tzinfo=None).timetuple()[:6]
            zf.writestr(info, source.read_bytes())


def build_zip_cli(output: Path, staged: list[tuple[Path, str]]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="secundair-export-") as tmp:
        staging = Path(tmp)
        (staging / "LEESMIJ.txt").write_text(README, encoding="utf-8")
        for source, arcname in staged:
            shutil.copy2(source, staging / arcname)

        names = ["LEESMIJ.txt", *[arcname for _, arcname in staged]]
        command = [
            "zip",
            "-X",
            "-j",
            str(output.resolve()),
            *names,
        ]
        result = subprocess.run(
            command,
            cwd=staging,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(
                "zip-commando mislukt: "
                + (result.stderr.strip() or result.stdout.strip() or "onbekende fout")
            )


def build_zip(output: Path) -> list[str]:
    staged = collect_sources()
    if not staged:
        raise RuntimeError(
            "Geen secundaire JSONL-bestanden gevonden. "
            "Run fetch:secundair of controleer test/fixtures/."
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()

    if shutil.which("zip"):
        build_zip_cli(output, staged)
    else:
        build_zip_python(output, staged)

    if not output.is_file() or output.stat().st_size < 64:
        raise RuntimeError(f"Zip-export mislukt: {output}")

    with zipfile.ZipFile(output) as zf:
        corrupt = zf.testzip()
        if corrupt:
            raise RuntimeError(f"Beschadigd zip-lid: {corrupt}")

    return ["LEESMIJ.txt", *[arcname for _, arcname in staged]]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Exporteer secundaire corpus als Windows-compatibele zip."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Uitvoerpad (default: {DEFAULT_OUTPUT.relative_to(ROOT)})",
    )
    args = parser.parse_args()
    output = args.output.resolve()

    included = build_zip(output)
    size_kb = output.stat().st_size / 1024
    print(f"Klaar: {output}")
    print(f"  Bestanden: {', '.join(included)}")
    print(f"  Grootte: {size_kb:.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
