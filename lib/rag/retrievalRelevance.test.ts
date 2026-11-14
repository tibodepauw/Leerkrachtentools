import { describe, expect, it } from 'vitest';
import { normalizeQueryText, queryMatchesMathTopic, scoreCurriculumCandidate, tokenizeCurriculumQuery } from './curriculumQueryTokens';
const score=(query:string,titel:string,discipline:string)=>scoreCurriculumCandidate({query,titel,haystack:`${titel} ${discipline}`,discipline}).score;
describe('topic fidelity of curriculum retrieval',()=>{
 it('does not turn an indefinite article into a numeric search constraint',()=>{
  expect(tokenizeCurriculumQuery('Een analoge klok aflezen').has('1')).toBe(false);
  expect(normalizeQueryText('een plus twee')).toContain('1 plus 2');
  expect(normalizeQueryText('optellen tot één')).toContain('tot 1');
 });
 it('cannot retrieve unrelated goals by negation alone',()=>{
  expect(score('Kwantumchromodynamica in niet-abelse ijktheorie.','Niet magnetisch materiaal sorteren','Wetenschap')).toBe(0);
 });
 it.each([
  ['De leerlingen lezen kwart voor en kwart over op een analoge klok.','De tijd aflezen op een klok met wijzers.','Wiskunde','Lees een tekst en bespreek de inhoud.','Nederlands'],
  ['De leerlingen beschermen hun wachtwoord en delen geen persoonsgegevens online.','Kies een veilig wachtwoord bij online communicatie.','ICT','Oefen deelbewerkingen met een deeltafel.','Wiskunde'],
  ['De leerlingen herkennen de eerste en laatste klank in een woord.','Identificeer de begin- en eindklank van een gesproken woord.','Nederlands','Herken de eerste en laatste getallen in een reeks.','Wiskunde'],
  ['De leerlingen bouwen een gesloten stroomkring met een batterij en lampje.','Een lamp laten branden met een elektrische stroomkring.','Wetenschap en techniek','Bouw een stevige constructie met materialen.','Wetenschap en techniek'],
  ['De leerlingen berekenen hoeveel wisselgeld ze terugkrijgen bij een aankoop.','Bij betalen de juiste hoeveelheid geld teruggeven.','Wiskunde','Bereken hoeveelheden met een verhoudingstabel.','Wiskunde'],
 ])('prioritizes the subject rather than a generic activity: %s',(query,good,goodDiscipline,bad,badDiscipline)=>{
  expect(score(query,good,goodDiscipline)).toBeGreaterThan(score(query,bad,badDiscipline));
 });
});

it('keeps online arithmetic mathematical rather than interpreting every online task as privacy',()=>{expect(queryMatchesMathTopic('De leerlingen delen 24 door 3 online.')).toBe(true);});

it('keeps musical tone colour distinct from phonological language exercises', () => {
  const query = 'De leerlingen onderscheiden de klankkleur van verschillende instrumenten.';
  expect(score(query, 'De klankkleur van instrumenten herkennen.', 'Muzische vorming'))
    .toBeGreaterThan(score(query, 'Klanken in woorden herkennen en onderscheiden.', 'Nederlands'));
});

it('keeps a literal reading objective ahead of broad writing synonyms', () => {
  const query = 'De leerlingen bepalen de hoofdgedachte van een informatieve tekst.';
  expect(score(query, 'De hoofdgedachte van een gelezen tekst verwoorden.', 'Nederlands'))
    .toBeGreaterThan(score(query, 'Relevante ideeën voor een geschreven tekst selecteren.', 'Nederlands'));
});
