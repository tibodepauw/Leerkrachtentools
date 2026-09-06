"""Installeer ontbrekende Python-deps voor curriculum-fetch."""

from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS_FILE = ROOT / "scripts/requirements-curriculum.txt"

CURRICULUM_PACKAGES = (
    ("requests", "requests"),
    ("bs4", "beautifulsoup4"),
    ("docx", "python-docx"),
    ("pypdf", "pypdf"),
)


def missing_modules(
    packages: tuple[tuple[str, str], ...] = CURRICULUM_PACKAGES,
) -> list[str]:
    missing: list[str] = []
    for module, pip_name in packages:
        try:
            __import__(module)
        except ImportError:
            missing.append(pip_name)
    return missing


def ensure_curriculum_python_deps(python: str | None = None) -> int:
    interpreter = python or sys.executable
    missing = missing_modules()
    if not missing:
        return 0

    logging.info(
        "Installeer ontbrekende Python-pakketten: %s",
        ", ".join(missing),
    )
    install = subprocess.run(
        [interpreter, "-m", "pip", "install", "-r", str(REQUIREMENTS_FILE)],
        cwd=ROOT,
    )
    if install.returncode != 0:
        logging.error(
            "pip install -r scripts/requirements-curriculum.txt is mislukt (exit %s).",
            install.returncode,
        )
        return install.returncode

    still_missing = missing_modules()
    if still_missing:
        logging.error(
            "Nog steeds ontbrekend na pip install: %s",
            ", ".join(still_missing),
        )
        return 1
    return 0


def ensure_playwright_chromium(python: str | None = None) -> int:
    interpreter = python or sys.executable
    try:
        import playwright  # noqa: F401
    except ImportError:
        return 0
    logging.info("Controleer Playwright Chromium...")
    return subprocess.run(
        [interpreter, "-m", "playwright", "install", "chromium"],
        cwd=ROOT,
    ).returncode
