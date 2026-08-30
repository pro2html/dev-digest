import { describe, expect, it } from 'vitest';
import { COVERAGE_NUDGE_EVAL_CASES } from '../src/db/seed-eval-cases.js';
import { parseExpectedOutput } from '../src/modules/evals/expected-output.js';

describe('COVERAGE_NUDGE_EVAL_CASES', () => {
  it('has five cases covering both expectation types with scorable output', () => {
    expect(COVERAGE_NUDGE_EVAL_CASES).toHaveLength(5);
    const names = COVERAGE_NUDGE_EVAL_CASES.map((c) => c.name);
    expect(new Set(names).size).toBe(5);

    const byExpectation = { must_find: 0, must_not_flag: 0 };
    for (const c of COVERAGE_NUDGE_EVAL_CASES) {
      const parsed = parseExpectedOutput(c.expectedOutput);
      expect(parsed.ok, c.name).toBe(true);
      if (!parsed.ok) continue;
      byExpectation[parsed.expectation] += 1;
      expect(c.inputDiff).toContain('diff --git');
      if (parsed.expectation === 'must_find') {
        expect(parsed.targets.length).toBeGreaterThan(0);
        expect(c.name.startsWith('must-find-')).toBe(true);
      } else {
        expect(parsed.targets).toEqual([]);
        expect(c.name.startsWith('must-not-flag-')).toBe(true);
      }
    }
    expect(byExpectation.must_find).toBe(3);
    expect(byExpectation.must_not_flag).toBe(2);
  });
});
