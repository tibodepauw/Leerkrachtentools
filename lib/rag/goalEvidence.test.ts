import { expect, it } from 'vitest';
import { selectGoalEvidence } from './goalEvidence';

it('selects literal matching development steps and retains their source age', () => {
  const step = 'Een gevoel uitbeelden met mimiek en lichaamshouding.';
  const raw = {leerlijn: [
    {leeftijd: '6-9j', ontwikkelstappen: [step, step]},
    {leeftijd: '10-12j', ontwikkelstappen: ['Een verzameling tot twintig tellen.']},
  ]};
  expect(selectGoalEvidence(raw, 'Gevoelens uitbeelden met mimiek en lichaamshouding'))
    .toEqual([{leeftijd: '6-9j', tekst: step}]);
});

it('bounds model context and tolerates malformed or missing source steps', () => {
  const raw = {leerlijn: [null, {}, {leeftijd: '8-10j', ontwikkelstappen: [false,
    'De klok lezen. '.repeat(100), 'De analoge klok aflezen.', 'De klok met wijzers lezen.',
  ]}]};
  const selected = selectGoalEvidence(raw, 'De klok lezen');
  expect(selected).toHaveLength(2);
  expect(selected.every(s => s.tekst.length <= 600 && s.leeftijd === '8-10j')).toBe(true);
  expect(selectGoalEvidence({}, 'De klok lezen')).toEqual([]);
});

it('retains distinct source ages when the same step recurs in another phase', () => {
  const raw = {leerlijn: ['6-8j', '8-10j'].map(leeftijd => ({leeftijd, ontwikkelstappen: ['De klok aflezen.']}))};
  expect(selectGoalEvidence(raw, 'De klok aflezen').map(s => s.leeftijd)).toEqual(['6-8j', '8-10j']);
});
