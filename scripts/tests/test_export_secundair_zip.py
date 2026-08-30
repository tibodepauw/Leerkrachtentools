from __future__ import annotations

import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from export_secundair_zip import build_zip


class ExportSecundairZipTests(unittest.TestCase):
    def test_builds_windows_compatible_zip_from_local_data(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "data" / "secundair"
            data_dir.mkdir(parents=True)
            (data_dir / "minimumdoelen_secundair.jsonl").write_text(
                json.dumps(
                    {
                        "code": "SO-TEST-1",
                        "titel": "Testdoel secundair",
                        "netwerk": "VLAANDEREN",
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            output = Path(tmp) / "secundair_update.zip"
            original_root = Path(__file__).resolve().parents[2]
            import export_secundair_zip as module

            previous_data_dir = module.DATA_DIR
            previous_default = module.DEFAULT_OUTPUT
            module.DATA_DIR = data_dir
            try:
                included = build_zip(output)
            finally:
                module.DATA_DIR = previous_data_dir
                module.DEFAULT_OUTPUT = previous_default

            self.assertIn("LEESMIJ.txt", included)
            self.assertIn("minimumdoelen_secundair.jsonl", included)
            self.assertTrue(output.is_file())
            self.assertGreater(output.stat().st_size, 100)

            with zipfile.ZipFile(output) as zf:
                self.assertIsNone(zf.testzip())
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
