import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from curriculum_pipeline.ovsg_secondary_authenticated import SecondaryOVSGClient, graph_nodes, secondary_rows
from curriculum_pipeline.http import Resource, SourceBlocked
from curriculum_pipeline.adapters import IncompleteSource


class SecondaryAccountTests(unittest.TestCase):
    def test_only_secondary_read_routes_are_allowed(self):
        with tempfile.TemporaryDirectory() as folder:
            client=SecondaryOVSGClient(Path(folder),"synthetic","synthetic")
            for suffix in ["", "/A-bv/sleutelcompetenties", "/A-bv/sleutelcompetenties/NED/leerlijnen",
                           "/B-bo/basisopties/TEC/leerlijnen/01"]:
                client.validate_url("https://leerlokaal.ovsg.be/so/leerplannen"+suffix)
            for suffix in ["/input","/so/doelenkiezer/exporteer/excel","/bao/leerplan",
                           "/so/leerplannen/A-bv/redactie"]:
                with self.assertRaises(SourceBlocked):
                    client.validate_url("https://leerlokaal.ovsg.be"+suffix)

    def test_all_slots_must_resolve_and_prerequisites_are_not_central_goals(self):
        fragments={"stroom":"A","leerplan":"bv","indeling":"NED","leerlijn":"01"}
        graph={"bronnen":{"slot":[{"uuid":"goal","entiteit":"slot"},{"uuid":"prior","entiteit":"slot"}]},
               "entiteiten":{"slot":{"goal":{},"prior":{}},
                   "schakel_leerplandoel":{"goal":{"slot_uuid":"goal","doel_uuid":"source-goal",
                       "code":"A bv NED 01 B 1","slug":"leerplandoel","omschrijving_html":"<p>Lezen.</p>",
                       "code_fragmenten":fragments}},
                   "schakel_voorkennis_bao":{"prior":{"slot_uuid":"prior","slug":"voorkennis-bao"}}}}
        resource=Resource("https://leerlokaal.ovsg.be/so/leerplannen/A-bv/sleutelcompetenties/NED/leerlijnen/01",
                          Path("unused"),{"sha256":"a"*64})
        plan={"code_fragmenten":fragments,"stroom_titel":"A-stroom","leerjaar":"Eerste leerjaar",
              "titel":"Basisvorming","nummer":"2025/001","leerplan_uuid":"plan"}
        section={"code":"NED","sleutelcompetentie_titel_alias":"Nederlands"}
        line={"code_fragmenten":fragments,"titel":"Lezen"}
        self.assertEqual(len(secondary_rows(graph,plan,section,line,resource)),1)
        graph["bronnen"]["slot"].append({"uuid":"empty", "entiteit":"slot"})
        graph["entiteiten"]["slot"]["empty"]={"slot_uuid":"empty","slug":"leeg"}
        self.assertEqual(len(secondary_rows(graph,plan,section,line,resource)),1)
        del graph["entiteiten"]["schakel_voorkennis_bao"]["prior"]
        with self.assertRaises(IncompleteSource): secondary_rows(graph,plan,section,line,resource)

    def test_inventory_totals_and_nested_references_are_verified(self):
        graph={"bronnen":{"leerlijn":[{"uuid":"one","entiteit":"leerlijn"}]},
               "entiteiten":{"leerlijn":{"one":{}}}}
        graph_nodes({"data_leerlijnen":graph},"data_leerlijnen","leerlijn",1)
        with self.assertRaises(IncompleteSource):graph_nodes({"data_leerlijnen":graph},"data_leerlijnen","slot",0)
        with self.assertRaises(IncompleteSource):graph_nodes({"data_leerlijnen":graph},"data_leerlijnen","leerlijn",2)
        graph["entiteiten"]["leerlijn"].clear()
        with self.assertRaises(IncompleteSource):graph_nodes({"data_leerlijnen":graph},"data_leerlijnen","leerlijn",1)
