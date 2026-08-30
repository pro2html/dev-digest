import { FULL_FILE_KINDS } from '@devdigest/reviewer-core';
import type { EvalExpectation } from '@devdigest/shared';
import type { EvalTarget } from './expected-output.js';
import { normalizeEvalPath } from './paths.js';

export type ScoreableFinding = {
  file: string;
  start_line: number;
  end_line: number;
  kind?: string | null;
};

export type CaseScore = {
  passed: boolean;
  expectation: EvalExpectation;
  matchedTargets: number;
  targetCount: number;
  matchedFindings: number;
  findingCount: number;
  keptCount: number;
  droppedCount: number;
};

export function scoreCase(input: {
  expectation: EvalExpectation;
  targets: EvalTarget[];
  kept: ScoreableFinding[];
  preGateCount: number;
}): CaseScore {
  const { expectation, targets, kept } = input;
  const preGateCount = Math.max(0, input.preGateCount);
  const droppedCount = Math.max(0, preGateCount - kept.length);

  if (expectation === 'must_not_flag') {
    return {
      passed: kept.length === 0,
      expectation,
      matchedTargets: 0,
      targetCount: 0,
      matchedFindings: 0,
      findingCount: kept.length,
      keptCount: kept.length,
      droppedCount,
    };
  }

  const used = new Set<number>();
  let matchedTargets = 0;
  for (const target of targets) {
    for (let i = 0; i < kept.length; i++) {
      if (used.has(i)) continue;
      if (findingMatchesTarget(kept[i]!, target)) {
        used.add(i);
        matchedTargets += 1;
        break;
      }
    }
  }

  const unmatchedFindings = kept.length - used.size;
  const passed = matchedTargets === targets.length && unmatchedFindings === 0;

  return {
    passed,
    expectation,
    matchedTargets,
    targetCount: targets.length,
    matchedFindings: used.size,
    findingCount: kept.length,
    keptCount: kept.length,
    droppedCount,
  };
}

function findingMatchesTarget(finding: ScoreableFinding, target: EvalTarget): boolean {
  const findingPath = normalizeEvalPath(finding.file);
  const targetPath = normalizeEvalPath(target.file);
  if (!findingPath || !targetPath || findingPath !== targetPath) return false;

  const kind = finding.kind ?? undefined;
  if (kind && FULL_FILE_KINDS.has(kind)) return true;

  return rangesOverlap(finding.start_line, finding.end_line, target.startLine, target.endLine);
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  const aLo = Math.min(aStart, aEnd);
  const aHi = Math.max(aStart, aEnd);
  const bLo = Math.min(bStart, bEnd);
  const bHi = Math.max(bStart, bEnd);
  return aLo <= bHi && bLo <= aHi;
}
