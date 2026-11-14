from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from curriculum_pipeline.http import HttpCache, SourceBlocked
from curriculum_pipeline.store import Catalog, normalize, refresh_lock


class Response:
    def __init__(self, status=200, body=b"", headers=None):
        self.status_code, self.body, self.headers = status, body, headers or {}

    def iter_content(self, _size):
        yield self.body

    def close(self):
        pass


class Session:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def get(self, url, **options):
        self.calls.append((url, options))
        return self.responses.pop(0)


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)

    def client(self, *responses, **options):
        session = Session(*responses)
        return HttpCache(self.root, {"source.example.test", "cdn.example.test"},
                         session=session, pause=0, **options), session

    def test_conditional_request_reuses_exact_verified_bytes(self):
        client, session = self.client(Response(body=b"User-agent: *\nDisallow:\n"),
                                      Response(body=b"complete source", headers={"ETag": '"version-a"'}),
                                      Response(status=304))
        first = client.fetch("https://source.example.test/goals")
        second = client.fetch("https://source.example.test/goals")
        self.assertEqual(first.content, second.content)
        self.assertEqual(first.sha256, hashlib.sha256(b"complete source").hexdigest())
        self.assertEqual(session.calls[-1][1]["headers"]["If-None-Match"], '"version-a"')
        self.assertEqual(client.metrics["not_modified"], 1)

    def test_robots_disallow_prevents_source_request(self):
        client, session = self.client(Response(body=b"User-agent: *\nDisallow: /\n"))
        with self.assertRaises(SourceBlocked):
            client.fetch("https://source.example.test/private")
        self.assertEqual(len(session.calls), 1)

    def test_explicit_resume_reuses_recent_bytes_without_inventing_a_new_check(self):
        client, _ = self.client(Response(body=b"User-agent: *\nDisallow:\n"), Response(body=b"source"))
        first = client.fetch("https://source.example.test/goals")
        resumed, session = self.client(recent_seconds=3600)
        second = resumed.fetch("https://source.example.test/goals")
        self.assertEqual(second.metadata["checked_at"], first.metadata["checked_at"])
        self.assertEqual(second.content, b"source")
        self.assertEqual(session.calls, [])
        resumed, session = self.client(Response(body=b"User-agent: *\nDisallow:\n"),
                                       Response(body=b"fresh source"), recent_seconds=3600)
        first.path.write_bytes(b"corrupted")
        # A recent but corrupt blob must go through validation and networking.
        self.assertEqual(resumed.fetch("https://source.example.test/goals").content, b"fresh source")
        self.assertEqual(len(session.calls), 2)

    def test_fresh_download_repairs_a_corrupted_existing_blob_with_the_same_hash(self):
        client, _ = self.client(Response(body=b"User-agent: *\nDisallow:\n"), Response(body=b"complete source"),
                                Response(body=b"complete source"))
        first = client.fetch("https://source.example.test/goals")
        first.path.write_bytes(b"bad")
        second = client.fetch(first.url)
        self.assertEqual(second.content, b"complete source")
        self.assertEqual(hashlib.sha256(second.content).hexdigest(), second.sha256)

    def test_keyed_redirect_never_sends_key_to_another_host(self):
        client, session = self.client(Response(body=b"User-agent: *\nDisallow:\n"),
                                      Response(status=302, headers={"Location": "https://cdn.example.test/next"}))
        with self.assertRaises(SourceBlocked):
            client.fetch("https://source.example.test/api", headers={"x-api-key": "synthetic-test-key"})
        self.assertEqual(len(session.calls), 2)

    def test_host_and_credential_validation_happens_before_network(self):
        client, session = self.client()
        for url in ["http://source.example.test/a", "https://localhost/a", "https://source.example.test.evil/a",
                    "https://user:secret@source.example.test/a", "https://source.example.test/a?api_key=secret"]:
            with self.subTest(url=url), self.assertRaises(SourceBlocked):
                client.fetch(url)
        self.assertEqual(session.calls, [])

    def test_oversized_update_cannot_poison_existing_cache(self):
        client, _ = self.client(Response(body=b"User-agent: *\nDisallow:\n"),
                               Response(body=b"good"), Response(body=b"too much data"), max_bytes=4)
        first = client.fetch("https://source.example.test/goals")
        with self.assertRaises(RuntimeError):
            client.fetch(first.url)
        self.assertEqual(first.content, b"good")
        offline = HttpCache(self.root, {"source.example.test"}, offline=True)
        self.assertEqual(offline.fetch(first.url).content, b"good")

    def test_corrupt_cached_blob_is_not_used_for_a_304(self):
        client, session = self.client(Response(body=b"User-agent: *\nDisallow:\n"),
                                      Response(body=b"good", headers={"ETag": "original"}),
                                      Response(status=304))
        resource = client.fetch("https://source.example.test/goals")
        resource.path.write_bytes(b"tampered")
        with self.assertRaises(RuntimeError):
            client.fetch(resource.url)
        self.assertNotIn("If-None-Match", session.calls[-1][1]["headers"])

    def test_retry_after_and_total_download_budget_preserve_last_good_bytes(self):
        client, session = self.client(Response(body=b"User-agent: *\nDisallow:\n"),
                                      Response(body=b"one"), Response(status=503, headers={"Retry-After": "0"}),
                                      Response(body=b"two"), run_bytes=5)
        first = client.fetch("https://source.example.test/goals")
        with self.assertRaisesRegex(SourceBlocked, "downloadbudget"):
            client.fetch(first.url)
        self.assertEqual(first.content, b"one")
        self.assertEqual(len(session.calls), 4)

    def test_long_retry_after_never_spins_or_retries_early(self):
        client, session = self.client(Response(body=b"User-agent: *\nDisallow:\n"),
                                      Response(status=429, headers={"Retry-After": "3600"}))
        with self.assertRaisesRegex(SourceBlocked, "later"):
            client.fetch("https://source.example.test/goals")
        self.assertEqual(len(session.calls), 2)

    def test_discovery_nonce_does_not_reparse_unchanged_documents(self):
        from curriculum_pipeline.adapters import Harvest
        first = Harvest([], [{"url": "https://source.example.test/book", "sha256": "one"}], lambda: [], {})
        same = Harvest([object()], first.inventory, lambda: [], {})
        changed = Harvest([], [{"url": "https://source.example.test/book", "sha256": "two"}], lambda: [], {})
        self.assertEqual(first.signature(), same.signature())
        self.assertNotEqual(first.signature(), changed.signature())


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        self.catalog = Catalog(self.root / "state", self.root / "data")
        self.addCleanup(self.catalog.close)
        self.goal = {"code": "WI.1", "titel": "De leerlingen vergelijken getallen.",
                     "bron_url": "https://source.example.test/current", "netwerk": "GO",
                     "graad": "1", "extra_context": {"routes": ["A", "B"]}}

    def publish(self, rows, **options):
        return self.catalog.publish("DEMO", rows, relative_path="demo/goals.jsonl", input_hash="v1",
                                    resources=[], coverage=options.get("coverage", {"complete": True}))

    def test_lossless_payload_compact_export_and_search_index(self):
        result = self.publish([self.goal])
        exported = self.root / "data/demo/goals.jsonl"
        row = json.loads(exported.read_text())
        self.assertEqual(row["extra_context"], {"routes": ["A", "B"]})
        self.assertTrue(self.catalog.verify("DEMO")["valid"])
        hits = self.catalog.db.execute("SELECT code FROM goal_search WHERE goal_search MATCH 'vergelijken'").fetchall()
        self.assertEqual([row[0] for row in hits], ["WI.1"])
        self.assertEqual(hashlib.sha256(exported.read_bytes()).hexdigest(), result["sha256"])

    def test_failed_or_partial_refresh_preserves_last_successful_corpus(self):
        self.publish([self.goal])
        previous = self.catalog.state("DEMO")
        for records, coverage in [([], {"complete": True}), ([self.goal], {"complete": False})]:
            with self.assertRaises(ValueError):
                self.publish(records, coverage=coverage)
        self.catalog.failed("DEMO", "blocked", "Source requires access")
        current = self.catalog.state("DEMO")
        self.assertEqual(current["content_hash"], previous["content_hash"])
        self.assertEqual(current["succeeded_at"], previous["succeeded_at"])
        self.assertEqual(current["checked_at"], previous["checked_at"])
        self.assertIsNotNone(current["last_attempt_at"])
        self.assertTrue(self.catalog.verify("DEMO")["valid"])
        self.assertEqual(current["status"], "blocked")

    def test_catalog_corruption_is_detected_even_when_export_and_count_stay_unchanged(self):
        self.publish([self.goal])
        with self.catalog.db:
            self.catalog.db.execute("UPDATE goals SET payload='{}' WHERE dataset='DEMO'")
        self.assertFalse(self.catalog.verify("DEMO")["valid"])

    def test_complete_raw_snapshot_keeps_unknown_validity_and_source_provenance(self):
        self.catalog.retain_source_records('SOURCE', [
            {'id':'one','domain':'SECUNDAIR','validity':'Onbekend','payload':{'original':'all details'},
             'source_url':'https://source.example.test/page1','source_sha256':'abc'},
        ])
        row = self.catalog.db.execute('SELECT validity,payload,source_url,source_sha256 FROM source_records').fetchone()
        self.assertEqual(tuple(row), ('Onbekend','{"original":"all details"}','https://source.example.test/page1','abc'))
        with self.assertRaises(ValueError):
            self.catalog.retain_source_records('SOURCE', [])
        self.assertEqual(self.catalog.db.execute('SELECT count(*) FROM source_records').fetchone()[0], 1)

    def test_source_artifact_survives_removal_of_download_cache(self):
        from curriculum_pipeline.http import Resource
        path = self.root / 'download'
        path.write_bytes(b'original document')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        self.catalog.archive_sources([Resource('https://source.example.test/document', path, {'sha256':digest})])
        path.unlink()
        import gzip
        self.assertEqual(gzip.decompress((self.root/'state/sources'/(digest+'.gz')).read_bytes()), b'original document')

    def test_offline_parser_cache_can_be_restored_from_the_durable_archive(self):
        from curriculum_pipeline.http import Resource
        path = self.root/'download'
        path.write_bytes(b'original document')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        url = 'https://source.example.test/document'
        checked = '2026-11-11T10:00:00+00:00'
        self.catalog.archive_sources([Resource(url, path, {'sha256':digest,'url':url,'checked_at':checked})])
        path.unlink()
        cache = HttpCache(self.root/'empty-cache', {'source.example.test'}, offline=True,
                          session=Session(), snapshot_lookup=self.catalog.source_snapshot)
        restored = cache.fetch(url)
        self.assertEqual(restored.content, b'original document')
        self.assertEqual(restored.metadata['checked_at'], checked)
        self.assertTrue(restored.path.is_file())
        self.assertEqual(cache.metrics['requests'], 0)

    def test_code_collision_across_contexts_is_preserved_and_text_edit_keeps_id(self):
        other = {**self.goal, "graad": "2"}
        self.assertEqual(self.publish([self.goal, other])["records"], 2)
        self.assertEqual(normalize(self.goal, "DEMO")["corpus_id"],
                         normalize({**self.goal, "titel": "Bijgewerkte doeltekst."}, "DEMO")["corpus_id"])
        with self.assertRaisesRegex(ValueError, "Botsende"):
            self.publish([self.goal, {**self.goal, "titel": "Andere context is niet aangeleverd."}])

    def test_export_can_be_rebuilt_without_rescraping(self):
        self.publish([self.goal])
        path = self.root / "data/demo/goals.jsonl"
        original = path.read_bytes()
        path.write_bytes(b"broken")
        self.assertFalse(self.catalog.verify("DEMO")["valid"])
        self.catalog.export("DEMO")
        self.assertEqual(path.read_bytes(), original)

    def test_failed_atomic_export_rolls_back_catalog(self):
        self.publish([self.goal])
        original = self.catalog.state("DEMO")["content_hash"]
        from curriculum_pipeline import store
        actual = store.atomic_bytes

        def fail_export(path, body):
            if path.name == "goals.jsonl" and b"Bijgewerkt" in body:
                raise OSError("synthetic disk failure")
            return actual(path, body)

        with patch.object(store, "atomic_bytes", fail_export), self.assertRaises(OSError):
            self.publish([{**self.goal, "titel": "Bijgewerkt doel"}])
        self.assertEqual(self.catalog.state("DEMO")["content_hash"], original)
        self.assertTrue(self.catalog.verify("DEMO")["valid"])

    def test_second_updater_cannot_run_while_lock_is_held(self):
        with refresh_lock(self.root):
            with self.assertRaises(OSError):
                with refresh_lock(self.root):
                    self.fail("second updater acquired the same lock")


class SourceParserTests(unittest.TestCase):
    def test_excel_worker_uses_the_real_package_and_does_not_shadow_stdlib_http(self):
        from openpyxl import Workbook
        from curriculum_pipeline.documents import parse_document
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'source.xlsx'
            workbook = Workbook()
            sheet = workbook.active
            sheet.append(['Type','Code','Doeltekst'])
            sheet.append(['doelzin','WI.1','De leerlingen tellen.'])
            workbook.save(path)
            workbook.close()
            rows = parse_document('go_new', path, {'doelenset_nummer':1,'discipline':'Wiskunde'})
            self.assertEqual([(row['code'],row['titel']) for row in rows], [('WI.1','De leerlingen tellen.')])

    def test_official_validity_uses_dates_and_never_assumes_unknown_is_current(self):
        from datetime import datetime, timezone
        from curriculum_pipeline.education import current_goal
        from curriculum_pipeline.adapters import IncompleteSource
        at = datetime(2026, 11, 11, tzinfo=timezone.utc)
        self.assertFalse(current_goal({'geldigheid': {'type': 'Onbekend'}}, at=at))
        self.assertFalse(current_goal({'geldigheid': {'type': 'Geldig', 'geldig_van_dt': '2027-09-01'}}, at=at))
        self.assertFalse(current_goal({'geldigheid': {'type': 'Geldig', 'geldig_tot_dt': '2026-11-11'}}, at=at))
        self.assertTrue(current_goal({'geldigheid': {'type': 'Geldig', 'geldig_van_dt': '2026-11-11'}}, at=at))
        with self.assertRaises(IncompleteSource):
            current_goal({'geldigheid': {'type': 'new status'}}, at=at)

    def test_pov_does_not_silently_drop_a_partial_or_malformed_list(self):
        from curriculum_pipeline.restricted import strict_list
        from curriculum_pipeline.adapters import IncompleteSource
        for payload in ({'data':[{}], 'total':2}, {'data':[{}], 'next':'page2'}, [None], []):
            with self.subTest(payload=payload), self.assertRaises(IncompleteSource):
                strict_list(payload)
        self.assertEqual(strict_list({'data':[{'id':'one'}], 'total':1}), [{'id':'one'}])

    def test_kindergarten_math_retains_goal_symbols_and_examples(self):
        from curriculum_pipeline.documents import old_go_early_math
        rows = old_go_early_math(['1.  RUIMTE\n1.1.   /  vormen vergelijken.\n              (O.D. 1.1.)\n               driehoeken sorteren\n1.2.     vormen benoemen.'],
                               {'title':'Wiskundige initiatie','url':'https://source.example.test/math'})
        self.assertEqual([row['code'] for row in rows], ['1.1','1.2'])
        self.assertEqual(rows[0]['onderwerp'], 'RUIMTE')
        self.assertIn('vormen vergelijken.', rows[0]['titel'])
        self.assertNotIn('driehoeken sorteren', rows[0]['titel'])
        self.assertIn('driehoeken sorteren', rows[0]['voorbeelden'][0])

    def test_old_french_goal_cards_keep_bis_codes_and_separate_examples(self):
        from curriculum_pipeline.documents import old_go_french
        page = '\n'.join(['Leerplan Frans - Lager onderwijs', 'Leerplandoelstellingen Luisteren', '',
                          '5.1            LUISTEREN OP BESCHRIJVEND NIVEAU',
                          '               De leerlingen begrijpen een boodschap.',
                          'Voorbeelden van leerinhouden'.ljust(55)+'Specifieke pedagogisch-didactische wenken',
                          'Een korte aankondiging.'.ljust(55)+'Gebruik een afbeelding.',
                          '5.1 BIS        De leerlingen herkennen de hoofdgedachte.'])
        rows = old_go_french([page], {'discipline':'Frans','title':'Leerplan','url':'https://source.example.test/french'})
        self.assertEqual([row['code'] for row in rows], ['5.1','5.1 BIS'])
        self.assertEqual(rows[0]['titel'], 'De leerlingen begrijpen een boodschap.')
        self.assertEqual(rows[0]['voorbeelden'], ['Een korte aankondiging.'])
        self.assertEqual(rows[0]['didactische_wenken'], ['Gebruik een afbeelding.'])

    def test_old_go_table_keeps_wrapped_text_references_and_year_markers(self):
        from curriculum_pipeline.documents import old_go_rows
        header = 'CODE'.ljust(14) + 'OD/ET'.ljust(14) + 'LEERPLANDOELSTELLINGEN'.ljust(45) + 'KO    LO'
        first = '1.1.1.  1'.ljust(14) + 'ET 1.1'.ljust(14) + 'De leerlingen vergelijken'.ljust(45) + 'x  X'
        continuation = ' '.ljust(14) + '6.3'.ljust(14) + 'getallen met materiaal.'
        second = '1.1.1.  2'.ljust(14) + 'ET 1.2'.ljust(14) + 'De leerlingen tellen.'
        rows = old_go_rows(['\n'.join([header,first,continuation,second])],
                           {'discipline':'Wiskunde','title':'Leerplan','url':'https://source.example.test/math'})
        self.assertEqual([row['code'] for row in rows], ['1.1.1.1','1.1.1.2'])
        self.assertEqual(rows[0]['titel'], 'De leerlingen vergelijken getallen met materiaal.')
        self.assertEqual(rows[0]['bron_paginas'], [1])
        self.assertIn('6.3', rows[0]['bron_verwijzingen'])
        self.assertEqual(rows[0]['bron_leerjaarmatrix'], ['x  X'])

    def test_source_zip_size_is_checked_before_any_document_parser(self):
        from curriculum_pipeline.documents import check_zip
        from io import BytesIO
        from zipfile import ZipFile, ZIP_DEFLATED
        buffer = BytesIO()
        with ZipFile(buffer, 'w', compression=ZIP_DEFLATED) as archive:
            with archive.open('word/document.xml','w') as output:
                for _ in range(33):
                    output.write(b'x' * (1024 * 1024))
        with self.assertRaisesRegex(ValueError, 'brononderdeel'):
            check_zip(buffer.getvalue())

    def test_zill_inventory_distinguishes_themes_from_explanatory_pages(self):
        from bs4 import BeautifulSoup
        from curriculum_pipeline.adapters import zill_routes
        soup = BeautifulSoup('<a href="#!/leerinhoud/SE/meer">Lees meer</a>'
                             '<a href="#!/leerinhoud/SE/rv"></a>'
                             '<a href="#!/leerinhoud/SE/rv">Relaties</a>', 'html.parser')
        self.assertEqual(zill_routes(soup, r'/leerinhoud/SE/[a-z]+'), {'/leerinhoud/SE/rv': 'Relaties'})

    def test_zill_keeps_ages_and_context_without_navigation_text(self):
        from bs4 import BeautifulSoup
        from curriculum_pipeline.adapters import zill_goal
        soup = BeautifulSoup('<h3>SErv1 Relaties</h3><section id="doel-item"><h5>Synthetisch doel</h5>'
                             '<section class="cd-timeline" development-steps-bao="goal.leerlijn.developmentSteps">'
                             '<div class="cd-timeline-block"><button>toggle menu</button></div>'
                             '<div class="cd-timeline-block"><age-range><div class="label-ll">2.5-4j</div></age-range>'
                             '<div class="cd-timeline-content"><p compile="description">Samen tellen.</p></div></div>'
                             '</section></section>', 'html.parser')
        row = zill_goal(soup, field='Sociaal', theme='Relaties', route='/leerinhoud/SE/rv/1',
                        source_url='https://source.example.test/goal')
        self.assertEqual(row['code'], 'SErv1')
        self.assertEqual(row['leerlijn'], [{'leeftijd': '2.5-4j', 'ontwikkelstappen': ['Samen tellen.']}])
        self.assertEqual(row['leerlijnen_per_context']['BaO'], row['leerlijn'])


if __name__ == "__main__":
    unittest.main()
