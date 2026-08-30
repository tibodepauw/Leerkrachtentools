from __future__ import annotations

import sys
import unittest
from io import BytesIO
from pathlib import Path

from docx import Document

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from secondary_minimum_goals_common import extract_api_goals, normalize_api_goal
from fetch_pov_secondary_curricula import normalize_pov_goal
from scrape_secondary_curricula import (
    SourceDocument,
    infer_discipline,
    infer_grade,
    infer_stream,
    parse_kov_docx,
)


class SecondaryCurriculumParserTests(unittest.TestCase):
    def test_infers_secondary_routes(self) -> None:
        self.assertEqual(infer_grade("Onderwijsdoelen eerste graad"), "1ste graad")
        self.assertEqual(infer_grade("Leerplan 3de graad"), "3de graad")
        self.assertEqual(infer_stream("Artistieke vorming A+B-stroom"), "A- en B-stroom")
        self.assertEqual(
            infer_discipline(
                "pdf Leerplan Leer Lokaal SO - eerste graad - A-stroom - "
                "basisvorming - SC 06 Wiskunde 09/07/2025"
            ),
            "Wiskunde",
        )

    def test_parses_kov_goal_styles_and_minimum_links(self) -> None:
        document = Document()
        document.add_heading("Leerplandoelen", level=1)
        minimum = document.add_paragraph(
            "MD 09.02 De leerlingen beschrijven landschappen. (LPD 1)"
        )
        minimum.style = document.styles["Normal"]
        # Productiedocumenten gebruiken deze stijlnamen.
        document.styles.add_style("MD + SMD + BK", 1)
        minimum.style = document.styles["MD + SMD + BK"]
        document.styles.add_style("Doel", 1)
        goal = document.add_paragraph(
            "De leerlingen beschrijven kenmerken van landschappen."
        )
        goal.style = document.styles["Doel"]

        payload = BytesIO()
        document.save(payload)
        source = SourceDocument(
            provider="KOV",
            title="Aardrijkskunde - A-stroom",
            url="https://example.test/aardrijkskunde.docx",
            page_url="https://pro.katholiekonderwijs.vlaanderen/I-Aar-a/leerplan",
            grade="1ste graad",
            stream="A-stroom",
            discipline="Aardrijkskunde",
            file_type="docx",
        )

        records = parse_kov_docx(payload.getvalue(), source)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].code, "I-Aar-a LPD 1")
        self.assertEqual(records[0].minimumdoel_codes, ["09.02"])


class SecondaryMinimumGoalsParserTests(unittest.TestCase):
    def test_normalizes_official_api_goal(self) -> None:
        result = normalize_api_goal(
            {
                "uniqueCode": "06.12",
                "title": "De leerlingen analyseren een wiskundig probleem.",
                "onderwijsniveau": "secundair onderwijs",
                "type": "eindterm",
                "graad": "eerste graad",
                "stroom": "A-stroom",
                "sleutelcompetentie": "Wiskunde",
            }
        )
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["gelinkt_minimumdoel"]["code"], "06.12")
        self.assertEqual(result["netwerk"], "VLAANDEREN")
        self.assertEqual(result["sleutelcompetentie_nr"], "")

    def test_normalizes_portal_goal_with_sc_metadata(self) -> None:
        from secondary_minimum_goals_common import normalize_portal_goal

        result = normalize_portal_goal(
            {
                "code": "06.12",
                "omschrijving": "<p>De leerlingen analyseren een wiskundig probleem.</p>",
                "onderwijsdoel_type": "Eindtermen",
                "_dataset": "SO_1STE_GRAAD_V2_1",
                "onderwijsdoelenset": {
                    "onderwijsdoelenset": "Secundair onderwijs 1ste graad A-stroom - Wiskunde - Eindtermen",
                    "vlaamse_sleutelcompetentie": {
                        "nr": "6",
                        "naam": "Wiskunde - natuurwetenschappen - technologie en techniek (STEM)",
                    },
                    "onderwijsstructuur": {
                        "graad": "1ste graad",
                        "stroom": "A-stroom",
                    },
                },
            }
        )
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["graad"], "1ste graad")
        self.assertEqual(result["stroom"], "A-stroom")
        self.assertEqual(result["sleutelcompetentie_nr"], "6")

    def test_deduplicates_nested_api_payloads(self) -> None:
        goal = {
            "code": "02.01",
            "titel": "De leerlingen verwerken doelgericht informatie.",
            "onderwijsniveau": "secundair onderwijs",
        }
        results = extract_api_goals([{"items": [goal, {"nested": goal}]}])
        self.assertEqual(len(results), 1)


class PovCurriculumParserTests(unittest.TestCase):
    def test_normalizes_detailed_api_goal(self) -> None:
        result = normalize_pov_goal(
            {
                "code": "LPD 3",
                "doelzin": "De leerlingen onderzoeken eigenschappen van materialen.",
                "vak": "Techniek",
            },
            {
                "naam": "Techniek - 2de graad - dubbele finaliteit",
            },
        )
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["netwerk"], "POV")
        self.assertEqual(result["graad"], "2de graad")
        self.assertEqual(result["finaliteit"], "dubbele finaliteit")


if __name__ == "__main__":
    unittest.main()
