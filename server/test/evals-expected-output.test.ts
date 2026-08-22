import { describe, expect, it } from 'vitest';
import { parseExpectedOutput } from '../src/modules/evals/expected-output.js';

describe('parseExpectedOutput', () => {
  it('refuses unparsable JSON with invalid_expected_output (AC-07)', () => {
    const result = parseExpectedOutput('{ not json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('invalid_expected_output');
    expect(result.field).toBe('expected_output');
  });

  it('names the missing field on an empty must_find envelope (AC-08)', () => {
    const emptyArray = parseExpectedOutput([]);
    expect(emptyArray.ok).toBe(false);
    if (emptyArray.ok) return;
    expect(emptyArray.code).toBe('invalid_expected_output');
    expect(emptyArray.field).toBe('file');

    const missingLine = parseExpectedOutput({
      expectation: 'must_find',
      findings: [{ file: 'src/a.ts' }],
    });
    expect(missingLine.ok).toBe(false);
    if (missingLine.ok) return;
    expect(missingLine.field).toBe('findings.0.start_line');
  });

  it('accepts a bare array as must_find and defaults end_line (AC-07, AC-08)', () => {
    const result = parseExpectedOutput([{ file: 'src/a.ts', start_line: 11 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expectation).toBe('must_find');
    expect(result.targets).toEqual([{ file: 'src/a.ts', startLine: 11, endLine: 11 }]);
  });
});
