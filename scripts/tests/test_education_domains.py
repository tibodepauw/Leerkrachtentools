from __future__ import annotations

import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from education_record_schema import classify_domain, normalize_api_goal_record


class EducationDomainSchemaTests(unittest.TestCase):
    def test_classifies_bubao(self) -> None:
        domain = classify_domain(
            set_name="Buitengewoon basisonderwijs Type 2 - Wiskunde",
            struct={
                "onderwijsniveau": "Basisonderwijs",
                "onderwijssoort": "Buitengewoon",
                "onderwijs_subniveau": "Lager Onderwijs",
            },
        )
        self.assertEqual(domain, "BUBAO")

    def test_classifies_buso_ov2(self) -> None:
        domain = classify_domain(
            struct={
                "onderwijsniveau": "Secundair onderwijs",
                "onderwijssoort": "Buitengewoon",
                "opleidingsvorm": "Opleidingsvorm 2",
            }
        )
        self.assertEqual(domain, "BUSO")

    def test_normalizes_api_goal(self) -> None:
        record = normalize_api_goal_record(
            {
                "code": "07.01",
                "omschrijving": "<p>De leerlingen reflecteren over identiteit.</p>",
                "onderwijsdoel_type": "Ontwikkelingsdoel",
                "onderwijsdoelenset": {
                    "onderwijsdoelenset": "Buitengewoon basisonderwijs Type 2 - Sociaal",
                    "onderwijsstructuur": {
                        "onderwijsniveau": "Basisonderwijs",
                        "onderwijssoort": "Buitengewoon",
                        "onderwijs_subniveau": "Lager Onderwijs",
                    },
                },
            },
            dataset="BUBAO",
        )
        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual(record["onderwijsniveau"], "BUBAO")
        self.assertEqual(record["netwerk"], "AHOVOKS")


if __name__ == "__main__":
    unittest.main()
