from __future__ import annotations

import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from export_secundair_zip import build_zip


class ExportSecundairZipTests(unittest.TestCase):
    def test_builds_windows_compatible_zip(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "secundair_update.zip"
            included = build_zip(output)

            self.assertIn("LEESMIJ.txt", included)
            self.assertTrue(any(name.endswith(".jsonl") for name in included))
            self.assertTrue(output.is_file())
            self.assertGreater(output.stat().st_size, 100)

            with zipfile.ZipFile(output) as zf:
                self.assertIsNone(zf.testzip())
                names = zf.namelist()
                self.assertIn("LEESMIJ.txt", names)
                for info in zf.infolist():
                    self.assertNotIn("\\", info.filename)
                    self.assertFalse(info.filename.startswith("/"))
                    self.assertNotIn("..", info.filename)
                    self.assertIn(
                        info.compress_type,
                        (zipfile.ZIP_DEFLATED, zipfile.ZIP_STORED),
                    )


if __name__ == "__main__":
    unittest.main()
