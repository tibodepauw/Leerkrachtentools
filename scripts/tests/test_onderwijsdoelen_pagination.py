from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from onderwijsdoelen_api_client import _get_json, fetch_all_goals


def page(members, total=None):
    return {"gegevens": {"member": members, **({"totalItems": total} if total is not None else {})}}


class OnderwijsdoelenPaginationTests(unittest.TestCase):
    def fetch(self, payloads, max_pages=3):
        with patch("onderwijsdoelen_api_client.resolve_api_key", return_value="synthetic-test-key"), patch(
            "onderwijsdoelen_api_client._get_json", side_effect=payloads
        ):
            return fetch_all_goals(rows_per_page=1, max_pages=max_pages, pause_seconds=0)

    def test_reads_every_page_until_reported_total(self):
        self.assertEqual(self.fetch([page([{"code": "1"}], 2), page([{"code": "2"}], 2)]), [{"code": "1"}, {"code": "2"}])

    def test_page_cap_cannot_return_a_truncated_corpus_as_success(self):
        with self.assertRaisesRegex(RuntimeError, "onvolledig"):
            self.fetch([page([{"code": "1"}], 3), page([{"code": "2"}], 3)], max_pages=2)

    def test_premature_empty_page_is_not_completion(self):
        with self.assertRaisesRegex(RuntimeError, "onvolledig"):
            self.fetch([page([{"code": "1"}], 2), page([], 2)])

    def test_repeated_page_cannot_satisfy_the_reported_total(self):
        with self.assertRaisesRegex(RuntimeError, "herhaalde pagina"):
            self.fetch([page([{"code": "1"}], 2), page([{"code": "1"}], 2)])

    def test_changed_total_requires_a_new_consistent_fetch(self):
        with self.assertRaisesRegex(RuntimeError, "totaal.*gewijzigd"):
            self.fetch([page([{"code": "1"}], 3), page([{"code": "2"}], 2)])

    def test_unknown_total_requires_an_empty_terminal_page(self):
        self.assertEqual(self.fetch([page([{"code": "1"}]), page([])]), [{"code": "1"}])

    def test_invalid_payload_is_not_an_empty_valid_corpus(self):
        for payload in [{}, {"gegevens": {"member": {}}}, {"gegevens": {"member": [None]}}]:
            with self.subTest(payload=payload), self.assertRaisesRegex(RuntimeError, "ongeldig"):
                self.fetch([payload])

    def test_http_404_is_not_an_empty_terminal_page(self):
        with patch("onderwijsdoelen_api_client.urlopen", side_effect=HTTPError("https://example.test", 404, "Not found", {}, None)) as request:
            with self.assertRaises(HTTPError):
                _get_json("https://example.test", "synthetic-test-key")
        request.assert_called_once()

    def test_invalid_or_exceeded_reported_total_fails(self):
        for total in [True, "unknown", -1, 0]:
            with self.subTest(total=total), self.assertRaisesRegex(RuntimeError, "ongeldig"):
                self.fetch([page([{"code": "1"}], total)])
