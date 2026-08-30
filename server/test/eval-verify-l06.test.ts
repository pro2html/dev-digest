import { describe, expect, it } from 'vitest';
import type {
  CompletionRequest,
  CompletionResult,
  Finding,
  LLMProvider,
  Review,
  StructuredRequest,
  StructuredResult,
} from '@devdigest/shared';
import { executeFrozenSet, type FrozenCase } from '../src/modules/evals/case-executor.js';
import { SKILL_BASELINE } from '../src/modules/evals/constants.js';
import { scoreCase } from '../src/modules/evals/scorer.js';
import type { ResolvedReviewerConfig } from '../src/modules/evals/reviewer-config.js';

const DIFF_A = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -10,3 +10,4 @@
 context
+added
 more
`;

const DIFF_B = `diff --git a/src/secrets.ts b/src/secrets.ts
--- a/src/secrets.ts
+++ b/src/secrets.ts
@@ -1,2 +1,3 @@
 keep
+SECRET
 keep
`;

function finding(over: Partial<Finding> & Pick<Finding, 'file' | 'start_line'>): Finding {
  return {
    id: over.id ?? `${over.file}:${over.start_line}`,
    severity: 'CRITICAL',
    category: 'security',
    title: over.title ?? 'issue',
    file: over.file,
    start_line: over.start_line,
    end_line: over.end_line ?? over.start_line,
    rationale: 'test',
    confidence: 0.9,
    kind: over.kind ?? 'finding',
  };
}

function review(findings: Finding[]): Review {
  return {
    verdict: findings.length ? 'request_changes' : 'approve',
    summary: findings.length ? 'issues' : 'clean',
    score: findings.length ? 40 : 95,
    findings,
  };
}

class ScriptedReviewLlm implements LLMProvider {
  readonly id = 'openai' as const;
  calls: { method: string }[] = [];
  constructor(private readonly reviews: Review[]) {}

  async listModels() {
    return [];
  }

  async complete(_req: CompletionRequest): Promise<CompletionResult> {
    this.calls.push({ method: 'complete' });
    return { text: '', model: 'mock', tokensIn: 0, tokensOut: 0, costUsd: 0 };
  }

  async completeStructured<T>(_req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    this.calls.push({ method: 'completeStructured' });
    const next = this.reviews.shift();
    if (!next) throw new Error('no scripted review left');
    return {
      data: next as T,
      model: 'mock',
      tokensIn: 10,
      tokensOut: 10,
      costUsd: 0.001,
      raw: JSON.stringify(next),
      attempts: 1,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    this.calls.push({ method: 'embed' });
    return texts.map(() => [0]);
  }
}

const CONFIG: ResolvedReviewerConfig = {
  provider: SKILL_BASELINE.provider,
  model: SKILL_BASELINE.model,
  strategy: SKILL_BASELINE.strategy,
  systemPrompt: SKILL_BASELINE.systemPrompt,
  skillBodies: [],
  ownerVersion: 1,
  baselineLabel: SKILL_BASELINE.label,
};

describe('verify:l06 eval pipeline (AC-50)', () => {
  it('scores eight frozen cases of both expectation types without a scoring model call (AC-23, AC-50)', async () => {
    const cases: FrozenCase[] = [
      {
        name: 'must-find-hit',
        inputDiff: DIFF_A,
        expectedOutput: {
          expectation: 'must_find',
          findings: [{ file: 'src/a.ts', start_line: 11 }],
        },
      },
      {
        name: 'must-find-extra-noise',
        inputDiff: DIFF_A,
        expectedOutput: {
          expectation: 'must_find',
          findings: [{ file: 'src/a.ts', start_line: 11 }],
        },
      },
      {
        name: 'must-find-miss',
        inputDiff: DIFF_A,
        expectedOutput: {
          expectation: 'must_find',
          findings: [{ file: 'src/a.ts', start_line: 11 }],
        },
      },
      {
        name: 'must-not-flag-empty',
        inputDiff: DIFF_A,
        expectedOutput: { expectation: 'must_not_flag', findings: [] },
      },
      {
        name: 'must-not-flag-noise',
        inputDiff: DIFF_A,
        expectedOutput: { expectation: 'must_not_flag', findings: [] },
      },
      {
        name: 'must-find-two-targets',
        inputDiff: DIFF_A,
        expectedOutput: {
          expectation: 'must_find',
          findings: [
            { file: 'src/a.ts', start_line: 10 },
            { file: 'src/a.ts', start_line: 11 },
          ],
        },
      },
      {
        name: 'must-find-wrong-file',
        inputDiff: DIFF_A,
        expectedOutput: {
          expectation: 'must_find',
          findings: [{ file: 'src/other.ts', start_line: 11 }],
        },
      },
      {
        name: 'must-find-full-file',
        inputDiff: DIFF_B,
        expectedOutput: {
          expectation: 'must_find',
          findings: [{ file: 'src/secrets.ts', start_line: 99 }],
        },
      },
    ];

    const scripted: Review[] = [
      review([finding({ file: 'src/a.ts', start_line: 11 })]),
      review([
        finding({ file: 'src/a.ts', start_line: 11 }),
        finding({ id: 'noise', file: 'src/a.ts', start_line: 10 }),
      ]),
      review([]),
      review([]),
      review([finding({ file: 'src/a.ts', start_line: 11 })]),
      review([
        finding({ file: 'src/a.ts', start_line: 10 }),
        finding({ id: 'second', file: 'src/a.ts', start_line: 11 }),
      ]),
      review([finding({ file: 'src/a.ts', start_line: 11 })]),
      review([finding({ file: 'src/secrets.ts', start_line: 1, kind: 'secret_leak' })]),
    ];

    const llm = new ScriptedReviewLlm(scripted);
    const { perCase, metrics } = await executeFrozenSet(cases, CONFIG, llm);

    expect(perCase).toHaveLength(8);
    expect(perCase.map((r) => r.error)).toEqual(Array(8).fill(undefined));
    expect(perCase.map((r) => r.score.passed)).toEqual([
      true,
      false,
      false,
      true,
      false,
      true,
      false,
      true,
    ]);

    expect(metrics.recall.value).toBeCloseTo(5 / 7, 8);
    expect(metrics.recall.not_applicable).toBe(false);
    expect(metrics.precision.value).toBeCloseTo(5 / 8, 8);
    expect(metrics.precision.not_applicable).toBe(false);
    expect(metrics.citation_accuracy.value).toBe(1);
    expect(metrics.passed).toBe(4);
    expect(metrics.total).toBe(8);

    const structuredCalls = llm.calls.filter((c) => c.method === 'completeStructured');
    expect(structuredCalls).toHaveLength(8);

    const before = llm.calls.length;
    scoreCase({
      expectation: 'must_find',
      targets: [{ file: 'src/a.ts', startLine: 11, endLine: 11 }],
      kept: [{ file: 'src/a.ts', start_line: 11, end_line: 11 }],
      preGateCount: 1,
    });
    expect(llm.calls.length).toBe(before);
  });
});
