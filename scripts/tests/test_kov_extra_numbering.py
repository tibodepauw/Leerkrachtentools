from io import BytesIO
from pathlib import Path
import sys
import unittest
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scrape_secondary_curricula import SourceDocument,parse_kov_docx
from secondary_record_schema import normalize_curriculum_record

class KovExtraNumberingTests(unittest.TestCase):
    def document(self, numbered=True):
        d=Document()
        for name in ['Doel','Doel: Extra','MD + SMD + BK']:d.styles.add_style(name,1)
        if numbered:
            abstract=OxmlElement('w:abstractNum');abstract.set(qn('w:abstractNumId'),'700')
            level=OxmlElement('w:lvl');level.set(qn('w:ilvl'),'0')
            for tag,value in [('start','2'),('numFmt','decimal'),('lvlText','LPD %1 +')]:
                e=OxmlElement('w:'+tag);e.set(qn('w:val'),value);level.append(e)
            abstract.append(level);d.part.numbering_part.element.append(abstract)
            num=OxmlElement('w:num');num.set(qn('w:numId'),'700');ref=OxmlElement('w:abstractNumId');ref.set(qn('w:val'),'700');num.append(ref);d.part.numbering_part.element.append(num)
            props=d.styles['Doel: Extra'].element.get_or_add_pPr();n=OxmlElement('w:numPr');ref=OxmlElement('w:numId');ref.set(qn('w:val'),'700');n.append(ref);props.append(n)
        d.add_heading('Communicatie',level=2)
        d.add_paragraph('MD 02. 08 Synthetisch minimumdoel. (LPD 3)',style='MD + SMD + BK')
        d.add_paragraph('MD 09.01 Ander regulier minimumdoel. (LPD 2)',style='MD + SMD + BK')
        d.add_paragraph('De leerlingen lezen een tekst.',style='Doel')
        d.add_paragraph('De leerlingen formuleren een eigen mening.',style='Doel: Extra')
        d.add_heading('Literatuur',level=2)
        d.add_paragraph('De leerlingen vertellen over een boek.',style='Doel')
        return d

    def parse(self,d):
        b=BytesIO();d.save(b)
        return parse_kov_docx(b.getvalue(),SourceDocument('KOV','Synthetic','https://example.test/plan.docx','https://example.test/I-Test-a/leerplan','1ste graad',stream='A-stroom',discipline='Nederlands'))

    def test_extra_keeps_source_label_and_later_minimum_links(self):
        rs=self.parse(self.document());self.assertEqual([r.code for r in rs],['I-Test-a LPD 1','I-Test-a LPD 2 +','I-Test-a LPD 3'])
        self.assertEqual(rs[1].subdomein,'Communicatie');self.assertEqual(rs[1].minimumdoel_codes,[])
        self.assertEqual(rs[2].subdomein,'Literatuur');self.assertEqual(rs[2].minimumdoel_codes,['02.08'])

    def test_unproven_extra_numbering_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'nummering'):self.parse(self.document(False))

    def test_export_preserves_context_and_minimum_links(self):
        rs=self.parse(self.document());r=normalize_curriculum_record(rs[-1])
        self.assertEqual(r.get('subdomein'),'Literatuur');self.assertEqual(r.get('minimumdoel_codes'),['02.08']);self.assertEqual(r.get('bron_titel'),'Synthetic')

    def test_conflicting_explicit_restart_is_rejected(self):
        d=self.document()
        num=OxmlElement('w:num');num.set(qn('w:numId'),'701')
        ref=OxmlElement('w:abstractNumId');ref.set(qn('w:val'),'700');num.append(ref)
        override=OxmlElement('w:lvlOverride');override.set(qn('w:ilvl'),'0')
        start=OxmlElement('w:startOverride');start.set(qn('w:val'),'9');override.append(start);num.append(override)
        d.part.numbering_part.element.append(num)
        props=d.paragraphs[-1]._p.get_or_add_pPr();n=OxmlElement('w:numPr')
        ref=OxmlElement('w:numId');ref.set(qn('w:val'),'701');n.append(ref);props.append(n)
        with self.assertRaisesRegex(ValueError,'herstart'):self.parse(d)
