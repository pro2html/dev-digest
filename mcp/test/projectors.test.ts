import { describe, it, expect } from 'vitest';
import {
  projectFinding,
  projectRunResult,
  RATIONALE_MAX,
  DEFAULT_MAX_FINDINGS,
} from '../src/schemas/results.js';

describe('projectors', () => {
  it('truncates long rationale/suggestion', () => {
    const long = 'x'.repeat(RATIONALE_MAX + 50);
    const f = projectFinding({
      id: '1',
      severity: 'WARNING',
      category: 'bug',
      title: 't',
      file: 'a.ts',
      start_line: 1,
      end_line: 1,
      rationale: long,
      suggestion: long,
    });
    expect(f.rationale!.length).toBe(RATIONALE_MAX);
    expect(f.rationale!.endsWith('…')).toBe(true);
    expect(f.suggestion!.endsWith('…')).toBe(true);
  });

  it('caps findings and sets findings_truncated', () => {
    const findings = Array.from({ length: DEFAULT_MAX_FINDINGS + 3 }, (_, i) => ({
      id: String(i),
      severity: 'SUGGESTION',
      category: 'style',
      title: `t${i}`,
      file: 'a.ts',
      start_line: i,
      end_line: i,
    }));
    const result = projectRunResult({
      run_id: 'r',
      agent_id: null,
      status: 'done',
      findings,
    });
    expect(result.findings).toHaveLength(DEFAULT_MAX_FINDINGS);
    expect(result.findings_truncated).toBe(true);
  });

  it('respects custom max_findings', () => {
    const findings = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      severity: 'SUGGESTION',
      category: 'style',
      title: `t${i}`,
      file: 'a.ts',
      start_line: i,
      end_line: i,
    }));
    const result = projectRunResult(
      { run_id: 'r', agent_id: 'a', status: 'done', findings },
      3,
    );
    expect(result.findings).toHaveLength(3);
    expect(result.findings_truncated).toBe(true);
  });
});
