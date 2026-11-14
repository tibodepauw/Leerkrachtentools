import copy
import hashlib
import sys
import tempfile
import unittest
import subprocess
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from curriculum_pipeline.http import Resource, SourceBlocked
from curriculum_pipeline.adapters import IncompleteSource
from curriculum_pipeline.ovsg_authenticated import AuthenticatedOVSGClient, line_records
from curriculum_pipeline.store import Catalog
from test_curriculum_pipeline import Session, Response


class AuthenticatedOvsgTests(unittest.TestCase):
    def graph(self):
        goal = {"uuid":"goal", "entiteit":"v2_leerplandoel", "relaties":{
            "v2_ondersteuningsdoelen":[{"uuid":"support","entiteit":"v2_differentiatiedoel"}],
            "v2_verdiepingsdoelen":[],
            "md_minimumdoelen":[{"uuid":"minimum","entiteit":"md_minimumdoel"}]}}
        return {"graaf":{"v2_leerlijn":[{"uuid":"line", "entiteit":"v2_leerlijn",
            "relaties":{"v2_leerplandoelen":[goal]}}]}, "register":{
                "v2_leerlijn":{"line":{"leerlijn_uuid":"line","titel":"Tellen"}},
                "v2_leerplandoel":{"goal":{"leerplandoel_uuid":"goal","leerlijn_uuid":"line",
                    "code":"WIS 1 B.1","omschrijving_html":"<p>Getallen vergelijken.</p>","fase_nr":3,
                    "is_cursief":True,"doelcategorie":"basis"}},
                "v2_differentiatiedoel":{"support":{"omschrijving_html":"<p>Gebruik <strong>blokken</strong>.</p>"}},
                "md_minimumdoel":{"minimum":{"code":"L4 2.1.1","omschrijving_tekst":"Vergelijken."}}}}

    def rows(self, graph=None, expected=1):
        source = Resource("https://leerlokaal.ovsg.be/bao/leerplan/leerlijn/wis-1",Path("unused"),{"sha256":"a"*64})
        return line_records(graph or self.graph(),"line",{"titel":"Wiskunde"},source,expected)

    def test_preserves_raw_markup_relations_differentiation_and_explicit_edition(self):
        row = self.rows()[0]
        self.assertEqual(row["titel"],"Getallen vergelijken.")
        self.assertEqual(row["bron_schooljaar"],"2027-2028")
        self.assertIn("2027-2028",row["leerjaar_route"])
        self.assertTrue(row["bron_record"]["is_cursief"])
        self.assertIn("<strong>",row["ondersteuning"][0]["omschrijving_html"])
        self.assertEqual(row["gelinkt_minimumdoel"]["code"],"L4 2.1.1")
        self.assertEqual(row["bron_relatieverwijzingen"]["v2_ondersteuningsdoelen"][0]["uuid"],"support")

    def test_incomplete_counts_wrong_owner_missing_relations_and_missing_text_stop_publication(self):
        cases=[]
        wrong=self.graph();wrong["register"]["v2_leerplandoel"]["goal"]["leerlijn_uuid"]="other";cases.append(wrong)
        missing=self.graph();missing["register"]["v2_differentiatiedoel"]={};cases.append(missing)
        empty=self.graph();empty["register"]["v2_leerplandoel"]["goal"]["omschrijving_html"]="<p></p>";cases.append(empty)
        nested=self.graph();nested["graaf"]["v2_leerlijn"][0]["relaties"]["samenhang"]=[
            {"uuid":"absent", "entiteit":"v2_leerlijn"}];cases.append(nested)
        for graph in cases:
            with self.subTest(graph=graph),self.assertRaises(IncompleteSource):self.rows(graph)
        with self.assertRaises(IncompleteSource):self.rows(expected=2)

    def test_client_cannot_reach_editorial_routes_other_hosts_queries_or_plain_http(self):
        with tempfile.TemporaryDirectory() as folder:
            client=AuthenticatedOVSGClient(Path(folder),"synthetic-user","synthetic-password")
            for url in ["https://leerlokaal.ovsg.be/input", "https://leerlokaal.ovsg.be/bao/input",
                        "https://leerlokaal.ovsg.be/so/leerplannen", "https://evil.test/bao/leerplan",
                        "http://leerlokaal.ovsg.be/bao/leerplan", "https://leerlokaal.ovsg.be/bao/leerplan?query=all"]:
                with self.subTest(url=url),self.assertRaises(SourceBlocked):client.validate_url(url)
            self.assertEqual(client.validate_url("https://leerlokaal.ovsg.be/bao/leerplan"),
                             "https://leerlokaal.ovsg.be/bao/leerplan")

    def test_invalid_delay_settings_fail_before_any_request(self):
        with tempfile.TemporaryDirectory() as folder:
            for minimum,maximum in [(-1,7),(10,2),(3,100)]:
                with self.assertRaises(ValueError):
                    AuthenticatedOVSGClient(Path(folder),"user","password",minimum=minimum,maximum=maximum)

    def test_authenticated_redirect_and_failed_login_stop_without_forwarding_credentials(self):
        for response in [Response(status=302, headers={"Location":"/bao/leerplan/leergebied/wis"}),
                         Response(status=401), Response(status=403)]:
            with self.subTest(status=response.status_code), tempfile.TemporaryDirectory() as folder:
                session = Session(response)
                client = AuthenticatedOVSGClient(Path(folder), "synthetic-user", "synthetic-password",
                                                session=session, minimum=0, maximum=0)
                with self.assertRaises(SourceBlocked):
                    client.fetch("https://leerlokaal.ovsg.be/bao/leerplan")
                self.assertEqual(len(session.calls), 1)
                headers = session.calls[0][1]["headers"]
                self.assertTrue(headers["Authorization"].startswith("Basic "))
                self.assertIn("Leerkrachtentools", headers["User-Agent"])
                self.assertFalse(session.calls[0][1]["allow_redirects"])
                self.assertEqual(list((Path(folder)/"urls").glob("*")), [])

    def test_offline_recovery_uses_durable_snapshot_without_login_or_network(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            session = Session(Response(body=b"synthetic private source"))
            client = AuthenticatedOVSGClient(root/"first", "user", "password", session=session,
                                            minimum=0, maximum=0)
            original = client.fetch("https://leerlokaal.ovsg.be/bao/leerplan")
            catalog = Catalog(root/"catalog", root/"data")
            try:
                catalog.archive_sources([original])
                no_network = Session()
                offline = AuthenticatedOVSGClient(root/"empty", "user", "password", offline=True,
                                                 session=no_network, snapshot_lookup=catalog.source_snapshot)
                recovered = offline.fetch(original.url)
                self.assertEqual(recovered.content, original.content)
                self.assertEqual(recovered.metadata["checked_at"], original.metadata["checked_at"])
                self.assertEqual(no_network.calls, [])
                self.assertNotIn("Authorization", str(recovered.metadata))
            finally:
                catalog.close()

    def test_public_refresh_preserves_existing_authenticated_dataset_and_timestamp(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            catalog = Catalog(root/"corpus", root)
            try:
                catalog.publish("OVSG_BAO_2027_2028", [{"code":"WIS 1", "titel":"Synthetisch doel",
                    "bron_url":"https://leerlokaal.ovsg.be/bao/leerplan"}],
                    relative_path="ovsg/ovsg_2027_2028_volledig.jsonl", input_hash="synthetic",
                    coverage={"complete":True}, resources=[])
                before = catalog.state("OVSG_BAO_2027_2028")
                result = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1]/"refresh_curriculum.py"),
                    "--datasets", "OVSG_BAO_2027_2028", "--data-root", str(root), "--cache-dir", str(root/"cache")],
                    capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn("manual_refresh_required", result.stdout)
                self.assertEqual(catalog.state("OVSG_BAO_2027_2028"), before)
                self.assertTrue(catalog.verify("OVSG_BAO_2027_2028")["valid"])
            finally:
                catalog.close()
