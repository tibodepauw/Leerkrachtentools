from __future__ import annotations
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scrape_secondary_curricula import SourceDocument, parse_pdf, SecondaryCurriculumScraper, GoalRecord

class SecondaryPdfLayoutTests(unittest.TestCase):
    def test_ovsg_goal_code_defines_its_stream_when_a_shared_download_label_differs(self):
        source = SourceDocument(provider='OVSG', title='A-stroom SC01', url='https://example.test/shared.pdf',
                                page_url='https://example.test/', grade='1ste graad', stream='A-stroom')
        text = 'B-LGZ.11.B.09\nDe leerlingen passen veiligheidsregels toe.\n'
        with patch('scrape_secondary_curricula.PdfReader', return_value=Mock(pages=[Mock(extract_text=lambda:text)])):
            record = parse_pdf(b'synthetic', source)[0]
        self.assertEqual(record.stroom, 'B-stroom')
        self.assertEqual(record.bron_stroom, 'A-stroom')
        self.assertIn('B-stroom', record.leerjaar_route)
        self.assertNotIn('A-stroom', record.leerjaar_route)
        self.assertIn('veiligheidsregels', record.bron_tekstblok)

    def source(self, grade='1ste graad', stream='A-stroom'):
        return SourceDocument(provider='GO', title='Synthetisch plan', url='https://example.test/plan.pdf', page_url='https://example.test/', grade=grade, stream=stream)

    def test_numbering_examples_are_not_goals(self):
        # Synthetic minimal layout reproducing the public GO! numbering section.
        text = ('Nummering van de leerplandoelen\nBV1_01.02\n01.02\n'
                'Links staat het volgnummer (bijvoorbeeld BV1_01.02).\n'
                'BV1_01.02.01\nSubdoel 1\nOok subdoelen krijgen een nummering.\n')
        actual = ('BV1_01.02\n01.02\nDe leerlingen ontwikkelen gezondheidsvaardigheden.\n'
                  'BV1_01.02.01\nSubdoel 1\nDe leerlingen passen richtlijnen voor ergonomie toe.\n')
        with patch('scrape_secondary_curricula.PdfReader', return_value=Mock(pages=[Mock(extract_text=lambda:text), Mock(extract_text=lambda:actual)])):
            records = parse_pdf(b'synthetic', self.source())
        self.assertEqual([r.code for r in records], ['BV1_01.02', 'BV1_01.02.01'])
        self.assertTrue(all(r.titel.startswith('De leerlingen') for r in records))

    def test_same_code_and_text_survive_in_different_contexts(self):
        text='BV1_01.02\nDe leerlingen ontwikkelen gezondheidsvaardigheden.\n'
        records=[]
        with patch('scrape_secondary_curricula.PdfReader', return_value=Mock(pages=[Mock(extract_text=lambda:text)])):
            for grade,stream in [('1ste graad','A-stroom'),('1ste graad','B-stroom'),('2de graad','A-stroom')]:
                records.extend(parse_pdf(b'synthetic', self.source(grade,stream)))
        self.assertEqual(len(SecondaryCurriculumScraper._dedupe_records(records)),3)
        self.assertEqual(len(SecondaryCurriculumScraper._dedupe_records(records+records)),3)

    def test_singular_learner_statement_excludes_table_labels(self):
        text = ('BG1_02.01.01\nSubdoel 1\n'
                'De leerling haalt bij het lezen doelgericht informatie uit teksten.\n')
        with patch('scrape_secondary_curricula.PdfReader', return_value=Mock(pages=[Mock(extract_text=lambda:text)])):
            records = parse_pdf(b'synthetic', self.source())
        self.assertEqual(records[0].titel, 'De leerling haalt bij het lezen doelgericht informatie uit teksten.')
