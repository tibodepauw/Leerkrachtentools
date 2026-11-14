from __future__ import annotations

import json
import sys
import tempfile
import unittest
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from curriculum_pipeline.ovsg_export import parse_secondary_export
from import_ovsg_export import main

HEADERS = ["doeltype", "code", "omschrijving", "leerlijn", "indeling", "leerplan"]
ROW = ["Leerplandoel", "A bv NED 01 B 01", "De leerlingen kiezen strategieën.",
       "Strategieën", "Sleutelcompetentie 2: Nederlands",
       "Leerplan eerste graad secundair onderwijs basisvorming A"]


def workbook(rows=None, headers=None):
    from openpyxl import Workbook
    book = Workbook()
    book.active.title = "Doelen"
    book.active.append(headers or HEADERS)
    for row in rows if rows is not None else [ROW]:
        book.active.append(row)
    buffer = BytesIO()
    book.save(buffer)
    book.close()
    return buffer.getvalue()


class OvsgExportTests(unittest.TestCase):
    def parse(self, payload):
        return parse_secondary_export(payload, {"title": "selectie.xlsx"})

    def test_real_header_contract_preserves_text_context_and_extra_fields(self):
        row = [*ROW, "Extra ondersteuning\nmet twee regels"]
        records = self.parse(workbook([row], [*HEADERS, "Ondersteuning"]))
        self.assertEqual(records[0]["code"], ROW[1])
        self.assertEqual(records[0]["discipline"], "Nederlands")
        self.assertEqual(records[0]["stroom"], "A-stroom")
        self.assertEqual(records[0]["bron_veldwaarden"]["Ondersteuning"], row[-1])
        self.assertIn("niet bewezen", records[0]["bron_omvang"])

    def test_closing_minimum_and_extension_types_are_not_silently_dropped(self):
        minimum = ["Minimumdoel", "A bv NED 01 B 02", *ROW[2:]]
        extension = ["Uitbreidingsdoel", "A bv NED 01 U 01", *ROW[2:]]
        records = self.parse(workbook([ROW, minimum, extension]))
        self.assertEqual([row["bron_doeltype"] for row in records], ["Leerplandoel", "Minimumdoel", "Uitbreidingsdoel"])

    def test_missing_and_duplicate_headers_fail_without_partial_output(self):
        for headers in (HEADERS[:-1], [*HEADERS, "CODE"]):
            with self.subTest(headers=headers), self.assertRaises(ValueError):
                self.parse(workbook([], headers))

    def test_formula_missing_text_duplicate_identity_and_empty_export_fail(self):
        formula = [*ROW]; formula[2] = "=1+1"
        missing = [*ROW]; missing[2] = None
        for rows in ([formula], [missing], [ROW, ROW], []):
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                self.parse(workbook(rows))

    def test_import_runs_bounded_worker_and_marks_selection_as_unpublished(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder)/"selectie.xlsx"
            output = Path(folder)/"controle.jsonl"
            source.write_bytes(workbook())
            self.assertEqual(main(["--input", str(source), "--output", str(output), "--expected-records", "1"]), 0)
            row = json.loads(output.read_text())
            self.assertEqual(row["code"], ROW[1])
            report = json.loads(output.with_suffix(".report.json").read_text())
            self.assertFalse(report["complete_collection"])
            self.assertFalse(report["published_to_app"])
            previous = output.read_bytes()
            with self.assertRaises(ValueError):
                main(["--input", str(source), "--output", str(output), "--expected-records", "2"])
            self.assertEqual(output.read_bytes(), previous)

    def test_import_refuses_an_active_app_destination(self):
        root = Path(__file__).resolve().parents[2]
        with self.assertRaises(SystemExit) as result:
            main(["--input", "unused.xlsx", "--output", str(root/"data/ovsg/ovsg_volledig.jsonl")])
        self.assertEqual(result.exception.code, 2)
