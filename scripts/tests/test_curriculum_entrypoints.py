from __future__ import annotations

import ast
import importlib.util
import subprocess
import sys
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

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
        spec = importlib.util.spec_from_file_location("fetch_all_curriculum", SCRIPTS / "fetch_all_curriculum.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with ExitStack() as stack:
            stack.enter_context(patch.object(sys, "argv", ["fetch_all_curriculum.py", "--domains-only"]))
            stack.enter_context(patch.object(module, "load_local_env"))
            stack.enter_context(patch.object(module, "ensure_curriculum_python_deps", return_value=0))
            stack.enter_context(patch.object(module, "ensure_playwright_chromium", return_value=0))
            run = stack.enter_context(patch.object(module, "run_step", return_value=0))
            stack.enter_context(patch("builtins.print"))
            self.assertEqual(module.main(), 0)
        self.assertEqual([Path(call.args[1][1]).name for call in run.call_args_list], ["fetch_onderwijsdoelen_domains.py"])
