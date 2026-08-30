import { describe, expect, it } from 'vitest';
import { currentNotApplicableOf, setRunToDto } from '../src/modules/evals/helpers.js';
import { aggregate } from '../src/modules/evals/metrics.js';
import type { CaseScore } from '../src/modules/evals/scorer.js';
import type { EvalSetRunRow } from '../src/modules/evals/types.js';

function score(over: Partial<CaseScore> & Pick<CaseScore, 'expectation'>): CaseScore {
  return {
    passed: false,
    matchedTargets: 0,
    targetCount: 0,
    matchedFindings: 0,
    findingCount: 0,
    keptCount: 0,
    droppedCount: 0,
    ...over,
  };
}

describe('aggregate metrics', () => {
  it('computes recall as matched must_find targets over must_find targets (AC-26)', () => {
    const metrics = aggregate([
      score({
        expectation: 'must_find',
        matchedTargets: 1,
        targetCount: 2,
        matchedFindings: 1,
        findingCount: 1,
        keptCount: 1,
      }),
      score({
        expectation: 'must_not_flag',
        findingCount: 1,
        keptCount: 1,
      }),
    ]);
    expect(metrics.recall.value).toBeCloseTo(1 / 2, 8);
    expect(metrics.recall.not_applicable).toBe(false);
  });

  it('computes precision as matched findings over grounded findings (AC-27)', () => {
    const metrics = aggregate([
      score({
        expectation: 'must_find',
        matchedTargets: 1,
        targetCount: 1,
        matchedFindings: 1,
        findingCount: 2,
        keptCount: 2,
      }),
    ]);
    expect(metrics.precision.value).toBeCloseTo(1 / 2, 8);
    expect(metrics.precision.not_applicable).toBe(false);
  });

  it('computes citation_accuracy from kept and dropped grounding counts (AC-28)', () => {
    const metrics = aggregate([
      score({
        expectation: 'must_find',
        keptCount: 3,
        droppedCount: 1,
        findingCount: 3,
        matchedFindings: 2,
        matchedTargets: 2,
        targetCount: 2,
      }),
    ]);
    expect(metrics.citation_accuracy.value).toBeCloseTo(3 / 4, 8);
    expect(metrics.citation_accuracy.not_applicable).toBe(false);
  });

  it('labels a zero-denominator metric as 1 + not_applicable (AC-29)', () => {
    const metrics = aggregate([
      score({ expectation: 'must_not_flag', passed: true }),
    ]);
    expect(metrics.recall).toEqual({ value: 1, not_applicable: true });
    expect(metrics.precision).toEqual({ value: 1, not_applicable: true });
    expect(metrics.citation_accuracy).toEqual({ value: 1, not_applicable: true });
  });

  it('returns whole-set and owner-dashboard flags as true, not null, for a zero-denominator set (AC-29)', () => {
    const metrics = aggregate([
      score({ expectation: 'must_not_flag', passed: true }),
    ]);
    const row = setRunRow({
      status: 'complete',
      recall: metrics.recall.value,
      precision: metrics.precision.value,
      citationAccuracy: metrics.citation_accuracy.value,
      recallNotApplicable: metrics.recall.not_applicable,
      precisionNotApplicable: metrics.precision.not_applicable,
      citationAccuracyNotApplicable: metrics.citation_accuracy.not_applicable,
    });

    const dto = setRunToDto(row);
    expect(dto.recall).toBe(1);
    expect(dto.precision).toBe(1);
    expect(dto.citation_accuracy).toBe(1);
    expect(dto.recall_not_applicable).toBe(true);
    expect(dto.precision_not_applicable).toBe(true);
    expect(dto.citation_accuracy_not_applicable).toBe(true);

    expect(currentNotApplicableOf(row)).toEqual({
      recall: true,
      precision: true,
      citation_accuracy: true,
    });
  });
});

function setRunRow(over: Partial<EvalSetRunRow>): EvalSetRunRow {
  return {
    id: 'run-1',
    workspaceId: 'ws-1',
    ownerKind: 'agent',
    ownerId: 'owner-1',
    ownerVersion: 1,
    systemPrompt: 'prompt',
    baselineLabel: null,
    status: 'complete',
    startedAt: new Date('2026-08-22T00:00:00.000Z'),
    finishedAt: new Date('2026-08-22T00:00:01.000Z'),
    casesTotal: 1,
    casesFinished: 1,
    passed: 1,
    recall: 1,
    precision: 1,
    citationAccuracy: 1,
    recallNotApplicable: null,
    precisionNotApplicable: null,
    citationAccuracyNotApplicable: null,
    costUsd: null,
    durationMs: 10,
    ...over,
  };
}
