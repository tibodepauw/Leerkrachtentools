from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
import sys

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from local_env import load_local_env, parse_env_line, unquote_env_value


class LocalEnvTests(unittest.TestCase):
    def test_parses_export_and_quotes(self) -> None:
        self.assertEqual(parse_env_line('export FOO="bar baz"'), ("FOO", "bar baz"))
        self.assertEqual(unquote_env_value("'abc'"), "abc")
        self.assertIsNone(parse_env_line("# comment"))

    def test_loads_env_local_without_overriding_existing(self) -> None:
        os.environ["KEEP_ME"] = "outside"
        os.environ.pop("ONDERWIJSDOELEN_API_KEY", None)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / ".env.local").write_text(
                "KEEP_ME=inside\nONDERWIJSDOELEN_API_KEY=test-key\n",
                encoding="utf-8",
            )
            loaded = load_local_env(root)
            self.assertEqual(loaded, root / ".env.local")
            self.assertEqual(os.environ["KEEP_ME"], "outside")
            self.assertEqual(os.environ["ONDERWIJSDOELEN_API_KEY"], "test-key")
        os.environ.pop("ONDERWIJSDOELEN_API_KEY", None)
        os.environ.pop("KEEP_ME", None)


if __name__ == "__main__":
    unittest.main()
