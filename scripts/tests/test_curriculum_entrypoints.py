from __future__ import annotations

import ast
import subprocess
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]


class CurriculumEntrypointTests(unittest.TestCase):
    def test_all_python_scripts_parse(self) -> None:
        for script in sorted(SCRIPTS.rglob("*.py")):
            with self.subTest(script=script.name):
                ast.parse(script.read_text(encoding="utf-8"), filename=str(script))

    def test_batch_help_does_not_fetch_or_install(self) -> None:
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "fetch_all_curriculum.py"), "--help"],
            capture_output=True, text=True, timeout=5,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--domains-only", result.stdout)

    def test_domains_only_does_not_fetch_other_curricula(self) -> None:
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "fetch_all_curriculum.py"), "--domains-only", "--list"],
            capture_output=True, text=True, timeout=5,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual({line.split(":", 1)[0] for line in result.stdout.splitlines()},
                         {"OKAN", "BUBAO", "BUSO", "DKO", "VOLWASSENEN", "HOGER"})

    def test_manual_entrypoint_never_installs_or_uploads(self) -> None:
        source = (SCRIPTS / "fetch_all_curriculum.py").read_text()
        for forbidden in ("ensure_curriculum_python_deps", "ensure_playwright_chromium", "subprocess", "upload"):
            self.assertNotIn(forbidden, source)
