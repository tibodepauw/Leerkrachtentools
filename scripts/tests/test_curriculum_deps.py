from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from curriculum_deps import missing_modules


class CurriculumDepsTests(unittest.TestCase):
    def test_reports_unknown_module_as_missing(self) -> None:
        missing = missing_modules((("definitely_not_a_real_module_zz", "demo-pkg"),))
        self.assertEqual(missing, ["demo-pkg"])

    def test_does_not_flag_stdlib(self) -> None:
        self.assertEqual(missing_modules((("json", "json"),)), [])
