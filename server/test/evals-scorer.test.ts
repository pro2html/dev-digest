import { describe, expect, it } from 'vitest';
import { scoreCase, type ScoreableFinding } from '../src/modules/evals/scorer.js';

function finding(
  file: string,
  start: number,
  end = start,
  kind?: string,
): ScoreableFinding {
  return { file, start_line: start, end_line: end, kind };
}

describe('scoreCase', () => {
  it('matches when normalized paths equal and line ranges overlap (AC-24)', () => {
    const hit = scoreCase({
      expectation: 'must_find',
      targets: [{ file: 'src/a.ts', startLine: 10, endLine: 12 }],
      kept: [finding('b/src/a.ts', 12, 14)],
      preGateCount: 1,
    });
    expect(hit.passed).toBe(true);
    expect(hit.matchedTargets).toBe(1);

    const miss = scoreCase({
      expectation: 'must_find',
      targets: [{ file: 'src/a.ts', startLine: 10, endLine: 12 }],
      kept: [finding('src/a.ts', 20, 22)],
      preGateCount: 1,
    });
    expect(miss.passed).toBe(false);
    expect(miss.matchedTargets).toBe(0);
  });

  it('matches full-file kinds on file identity alone (AC-24)', () => {
    const score = scoreCase({
      expectation: 'must_find',
      targets: [{ file: 'src/secrets.ts', startLine: 99, endLine: 99 }],
      kept: [finding('src/secrets.ts', 1, 1, 'secret_leak')],
      preGateCount: 1,
    });
    expect(score.passed).toBe(true);
    expect(score.matchedTargets).toBe(1);
  });

  it('passes only when every target matched and no grounded finding is leftover (AC-30)', () => {
    const targets = [
      { file: 'src/a.ts', startLine: 10, endLine: 10 },
      { file: 'src/a.ts', startLine: 11, endLine: 11 },
    ];
    const pass = scoreCase({
      expectation: 'must_find',
      targets,
      kept: [finding('src/a.ts', 10), finding('src/a.ts', 11)],
      preGateCount: 2,
    });
    expect(pass.passed).toBe(true);

    const leftover = scoreCase({
      expectation: 'must_find',
      targets: [{ file: 'src/a.ts', startLine: 10, endLine: 10 }],
      kept: [finding('src/a.ts', 10), finding('src/a.ts', 11)],
      preGateCount: 2,
    });
    expect(leftover.passed).toBe(false);
  });

  it('treats any grounded finding as noise for must_not_flag (AC-31)', () => {
    const elsewhere = scoreCase({
      expectation: 'must_not_flag',
      targets: [{ file: 'src/a.ts', startLine: 10, endLine: 10 }],
      kept: [finding('src/other.ts', 1)],
      preGateCount: 1,
    });
    expect(elsewhere.passed).toBe(false);
    expect(elsewhere.findingCount).toBe(1);

    const clean = scoreCase({
      expectation: 'must_not_flag',
      targets: [],
      kept: [],
      preGateCount: 0,
    });
    expect(clean.passed).toBe(true);
  });

  it('maps findings to targets one-to-one so a duplicate is noise (AC-32)', () => {
    const score = scoreCase({
      expectation: 'must_find',
      targets: [
        { file: 'src/a.ts', startLine: 10, endLine: 12 },
        { file: 'src/a.ts', startLine: 10, endLine: 12 },
      ],
      kept: [finding('src/a.ts', 11)],
      preGateCount: 1,
    });
    expect(score.matchedTargets).toBe(1);
    expect(score.passed).toBe(false);
  });

  it('scores empty grounded output as a legitimate result, not an error (AC-33)', () => {
    const score = scoreCase({
      expectation: 'must_find',
      targets: [{ file: 'src/a.ts', startLine: 11, endLine: 11 }],
      kept: [],
      preGateCount: 0,
    });
    expect(score.passed).toBe(false);
    expect(score.findingCount).toBe(0);
    expect(score.keptCount).toBe(0);
    expect(score.droppedCount).toBe(0);
  });
});
