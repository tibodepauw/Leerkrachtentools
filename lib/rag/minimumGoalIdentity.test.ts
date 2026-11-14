import { expect, it } from 'vitest';
import { normalizeMinimumGoalCandidate } from './minimumGoalCandidates';
import { dedupeByMinimumGoalCode } from './curriculumCorpus';
import { buildProCurriculumPrompt, groundProPicks, parseProLessonContext } from './selectProCurriculumGoals';

it('keeps distinct official sources with the same code in retrieval and Pro output', () => {
  const records = [4, 6].map(year => normalizeMinimumGoalCandidate({
    code: '2.1.99', corpus_id: `synthetic-source-${year}`,
    titel: `Synthetische breukenoefening op ijkpunt ${year}.`,
    discipline: `Lager Onderwijs ${year}de leerjaar`, onderwijsniveau: 'LAGER', netwerk: 'AHOVOKS',
    onderwijsdoelenset: {vakdiscipline: {naam: 'Wiskunde'}, onderwijsstructuur: {leerjaar: `${year}de leerjaar`}},
  })!);
  expect(records.map(r => r.leerjaarRoute)).toEqual(['4de leerjaar', '6de leerjaar']);
  const prompt = buildProCurriculumPrompt({
    query: 'Breuken vergelijken', retrieved: records, kind: 'minimumdoel',
    lesson: parseProLessonContext({grade: 'l4'}),
  });
  expect(prompt).toContain('"leerjaarRoute": "4de leerjaar"');
  expect(prompt).toContain('"leerjaarRoute": "6de leerjaar"');
  expect(dedupeByMinimumGoalCode([...records, records[0]])).toHaveLength(2);
  expect(groundProPicks(records, [
    {nr: 1, code: '2.1.99', why: 'Eerste ijkpunt.'},
    {nr: 2, code: '2.1.99', why: 'Tweede ijkpunt.'},
  ], 'minimumdoel')).toHaveLength(2);
});

it('retains secondary grade and finality when the source also specifies a school year', () => {
  const result = normalizeMinimumGoalCandidate({
    code: '06.99', titel: 'Synthetische secundaire oefening.', netwerk: 'AHOVOKS',
    onderwijsniveau: 'SECUNDAIR', graad: '3de graad', finaliteit: 'Eindtermen',
    onderwijsdoelenset: {onderwijsstructuur: {leerjaar: '3de leerjaar'}},
  });
  expect(result?.leerjaarRoute).toContain('3de graad');
  expect(result?.leerjaarRoute).toContain('Eindtermen');
  expect(result?.leerjaarRoute).toContain('3de leerjaar');
});

it('reads the subject of legacy minimum goals instead of a generic primary-school label', () => {
  const result = normalizeMinimumGoalCandidate({
    code: '6', titel: 'De hoofdgedachte van een tekst achterhalen.', netwerk: 'AHOVOKS',
    onderwijsniveau: 'LAGER', discipline: 'Lager Onderwijs',
    onderwijsdoelenset: {indeling_onderwijsdoelen: {type: 'Leergebied', waarde: 'Frans'}, korte_naam: 'Frans'},
  });
  expect(result?.discipline).toBe('Frans');
});
