import { expect, it } from 'vitest';
import { applyTargetGroupRanking } from './targetGroupBonus';
import type { CurriculumSearchResult } from '@/types';

it('lets the selected grade reorder close matches without flattening their relevance scores', () => {
  const base: CurriculumSearchResult = {
    code: 'synthetic', titel: 'Synthetische oefening', discipline: 'Wiskunde',
    subdomein: '', toelichting: '', leerjaarRoute: '', netwerk: 'GO_NIEUW', bronUrl: '', verrijking: 'corpus', gelinktMinimumdoel: null,
  };
  const ranked = applyTargetGroupRanking([
    {...base, code: 'advanced', leerjaarRoute: '6de leerjaar', score: 1.8},
    {...base, code: 'selected', leerjaarRoute: '1ste leerjaar', score: 1.7},
  ], {grade: 'l1'});
  expect(ranked[0].code).toBe('selected');
  expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
});
