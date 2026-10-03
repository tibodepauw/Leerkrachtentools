from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from curriculum_deps import missing_modules


class CurriculumDepsTests(unittest.TestCase):
    def test_checks_browser_and_excel_dependencies_even_when_core_modules_exist(self) -> None:
        def partial_install(name, *args, **kwargs):
            if name in {"playwright", "openpyxl", "pandas"}:
                raise ImportError(name)
            return object()

        with patch("builtins.__import__", side_effect=partial_install):
            self.assertEqual(set(missing_modules()), {"playwright", "openpyxl", "pandas"})

    def test_reports_unknown_module_as_missing(self) -> None:
        missing = missing_modules((("definitely_not_a_real_module_zz", "demo-pkg"),))
        self.assertEqual(missing, ["demo-pkg"])

    def test_does_not_flag_stdlib(self) -> None:
        self.assertEqual(missing_modules((("json", "json"),)), [])
