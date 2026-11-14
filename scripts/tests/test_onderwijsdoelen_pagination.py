from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
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

    def test_official_ids_preserve_distinct_title_hierarchies_with_the_same_goal_code(self):
        first = {"@id": 101, "code": "11.01.01", "onderwijsdoelenset": {"onderwijsdoelenset_id": 1}, "titels": ["Context A"]}
        second = {**first, "@id": 102, "titels": ["Context B"]}
        self.assertEqual(self.fetch([page([first, second], 2)]), [first, second])

    def test_same_official_id_with_changed_metadata_cannot_inflate_total(self):
        first = {"@id": 101, "code": "1", "omschrijving": "Eerste tekst"}
        second = {**first, "omschrijving": "Gewijzigde tekst", "publicatie_dt": "2026-11-11"}
        with self.assertRaisesRegex(RuntimeError, "overlap"):
            self.fetch([page([first], 2), page([second], 2)])

    def test_same_official_goal_in_distinct_source_sets_preserves_both_contexts(self):
        first = {"@id": 101, "code": "1", "onderwijsdoelenset": {"onderwijsdoelenset_id": 1}}
        second = {**first, "onderwijsdoelenset": {"onderwijsdoelenset_id": 2}}
        self.assertEqual(self.fetch([page([first, second], 2)]), [first, second])

    def test_same_goal_and_set_in_distinct_source_appendices_preserves_context(self):
        first = {"@id": 101, "code": "1", "onderwijsdoelenset": {"onderwijsdoelenset_id": 1},
                 "titels": {"1": {"nr": "2.3", "titel": "Rekenen", "bijlage": "Begripsvorming"}}}
        second = {**first, "titels": {"1": {"nr": "2.3", "titel": "Rekenen", "bijlage": "Procedures"}}}
        self.assertEqual(self.fetch([page([first, second], 2)]), [first, second])

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
        opener = Mock()
        opener.open.side_effect = HTTPError("https://example.test", 404, "Not found", {}, None)
        with patch("onderwijsdoelen_api_client.build_opener", return_value=opener):
            with self.assertRaises(HTTPError):
                _get_json("https://example.test", "synthetic-test-key")
        opener.open.assert_called_once()

    def test_invalid_or_exceeded_reported_total_fails(self):
        for total in [True, "unknown", -1, 0]:
            with self.subTest(total=total), self.assertRaisesRegex(RuntimeError, "ongeldig"):
                self.fetch([page([{"code": "1"}], total)])

    def test_overlapping_pages_cannot_satisfy_reported_total(self):
        with self.assertRaisesRegex(RuntimeError, "overlap"):
            self.fetch([
                page([{"code": "A"}, {"code": "B"}], 4),
                page([{"code": "B"}, {"code": "C"}], 4),
            ])

    def test_duplicate_within_one_page_cannot_satisfy_total(self):
        with self.assertRaisesRegex(RuntimeError, "overlap"):
            self.fetch([page([{"code": "A"}, {"code": "A"}], 2)])

    def test_same_code_in_different_goal_sets_is_preserved(self):
        records = [
            {"code": "A", "onderwijsdoelenset": {"onderwijsdoelenset": "Set 1", "onderwijsstructuur": {"graad": "1ste graad"}}},
            {"code": "A", "onderwijsdoelenset": {"onderwijsdoelenset": "Set 2", "onderwijsstructuur": {"graad": "2de graad"}}},
        ]
        self.assertEqual(self.fetch([page([records[0]], 2), page([records[1]], 2)]), records)

    def test_same_code_and_context_with_changed_text_is_not_a_new_goal(self):
        first = {"code": "A", "onderwijsdoelenset": {"onderwijsdoelenset": "Set 1"}, "omschrijving": "First text"}
        changed = {"omschrijving": "Changed text", "onderwijsdoelenset": {"onderwijsdoelenset": "Set 1"}, "code": "A"}
        with self.assertRaisesRegex(RuntimeError, "overlap"):
            self.fetch([page([first], 2), page([changed], 2)])

    def test_context_key_order_does_not_make_a_goal_unique(self):
        first = {"code": "A", "onderwijsdoelenset": {"onderwijsdoelenset": "Set 1", "onderwijsstructuur": {"graad": "1ste graad"}}}
        reordered = {"onderwijsdoelenset": {"onderwijsstructuur": {"graad": "1ste graad"}, "onderwijsdoelenset": "Set 1"}, "code": "A"}
        with self.assertRaisesRegex(RuntimeError, "overlap|herhaalde pagina"):
            self.fetch([page([first], 2), page([reordered], 2)])

    def test_goal_type_and_dataset_are_part_of_context(self):
        records = [
            {"code": "A", "onderwijsdoel_type": "Eindterm", "_dataset": "SET_1"},
            {"code": "A", "onderwijsdoel_type": "Ontwikkelingsdoel", "_dataset": "SET_1"},
            {"code": "A", "onderwijsdoel_type": "Eindterm", "_dataset": "SET_2"},
        ]
        self.assertEqual(self.fetch([page(records, 3)]), records)

    def test_same_code_and_set_name_in_distinct_structures_is_preserved(self):
        records = [
            {"code": "A", "onderwijsdoelenset": {"onderwijsdoelenset": "Set 1", "onderwijsstructuur": {"opleidingsvorm": "OV1"}}},
            {"code": "A", "onderwijsdoelenset": {"onderwijsdoelenset": "Set 1", "onderwijsstructuur": {"opleidingsvorm": "OV2"}}},
        ]
        self.assertEqual(self.fetch([page(records, 2)]), records)
