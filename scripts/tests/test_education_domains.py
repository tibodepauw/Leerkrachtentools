from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from education_record_schema import classify_domain, normalize_api_goal_record
from fetch_onderwijsdoelen_domains import collect_raw_goals


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

    def test_falls_back_to_portal_when_api_key_is_missing(self) -> None:
        async def fake_portal():
            return [{"code": "OKAN-1"}]

        with patch(
            "fetch_onderwijsdoelen_domains.fetch_all_goals",
            side_effect=ValueError("ONDERWIJSDOELEN_API_KEY ontbreekt"),
        ), patch(
            "fetch_onderwijsdoelen_domains.fetch_portal_domain_goals",
            new=fake_portal,
        ):
            raw, source = collect_raw_goals()
        self.assertEqual(raw, [{"code": "OKAN-1"}])
        self.assertEqual(source, "www.onderwijsdoelen.be/doelen")


if __name__ == "__main__":
    unittest.main()
