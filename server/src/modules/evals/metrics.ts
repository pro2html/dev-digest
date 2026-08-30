import type { CaseScore } from './scorer.js';

export type MetricValue = {
  value: number;
  not_applicable: boolean;
};

export type AggregateMetrics = {
  recall: MetricValue;
  precision: MetricValue;
  citation_accuracy: MetricValue;
  passed: number;
  total: number;
};

/** Aggregate per-case scores. Zero-denominator metrics report 1 + not_applicable. */
export function aggregate(perCase: CaseScore[]): AggregateMetrics {
  let mustFindMatched = 0;
  let mustFindTargets = 0;
  let matchedFindings = 0;
  let groundedFindings = 0;
  let kept = 0;
  let preGate = 0;
  let passed = 0;

  for (const row of perCase) {
    if (row.expectation === 'must_find') {
      mustFindMatched += row.matchedTargets;
      mustFindTargets += row.targetCount;
    }
    matchedFindings += row.matchedFindings;
    groundedFindings += row.findingCount;
    kept += row.keptCount;
    preGate += row.keptCount + row.droppedCount;
    if (row.passed) passed += 1;
  }

  return {
    recall: ratio(mustFindMatched, mustFindTargets),
    precision: ratio(matchedFindings, groundedFindings),
    citation_accuracy: ratio(kept, preGate),
    passed,
    total: perCase.length,
  };
}

function ratio(num: number, den: number): MetricValue {
  if (den === 0) return { value: 1, not_applicable: true };
  return { value: num / den, not_applicable: false };
}
