import { reviewPullRequest } from '@devdigest/reviewer-core';
import type { Finding, LLMProvider } from '@devdigest/shared';
import { parseUnifiedDiff } from '../../adapters/index.js';
import { parseExpectedOutput } from './expected-output.js';
import { prDescriptionFromMeta } from './helpers.js';
import { aggregate, type AggregateMetrics } from './metrics.js';
import type { ResolvedReviewerConfig } from './reviewer-config.js';
import { scoreCase, type CaseScore, type ScoreableFinding } from './scorer.js';

export type FrozenCase = {
  name: string;
  inputDiff: string;
  inputMeta?: unknown;
  expectedOutput: unknown;
};

export type ExecutedCase = {
  score: CaseScore;
  kept: Finding[];
  durationMs: number;
  costUsd: number | null;
  actualOutput: unknown;
  error?: string;
};

/**
 * Replay a frozen case through the real review engine. No diff-loader, GitHub,
 * git adapter, or filesystem. Diff / PR meta enter only via ReviewInput slots
 * (wrapUntrusted happens inside assemblePrompt).
 */
export async function executeFrozenCase(input: {
  case: FrozenCase;
  config: ResolvedReviewerConfig;
  llm: LLMProvider;
}): Promise<ExecutedCase> {
  const started = Date.now();
  const parsed = parseExpectedOutput(input.case.expectedOutput);
  if (!parsed.ok) {
    return {
      score: {
        passed: false,
        expectation: 'must_find',
        matchedTargets: 0,
        targetCount: 0,
        matchedFindings: 0,
        findingCount: 0,
        keptCount: 0,
        droppedCount: 0,
      },
      kept: [],
      durationMs: Date.now() - started,
      costUsd: null,
      actualOutput: null,
      error: parsed.message,
    };
  }

  try {
    const diff = parseUnifiedDiff(input.case.inputDiff);
    const prDescription = prDescriptionFromMeta(input.case.inputMeta);
    const outcome = await reviewPullRequest({
      systemPrompt: input.config.systemPrompt,
      model: input.config.model,
      diff,
      llm: input.llm,
      strategy: input.config.strategy,
      ...(input.config.skillBodies.length ? { skills: input.config.skillBodies } : {}),
      ...(prDescription ? { prDescription } : {}),
      task: `Eval case: ${input.case.name}`,
    });

    const kept = outcome.review.findings;
    const dropped = outcome.dropped.length;
    const preGateCount = kept.length + dropped;
    const score = scoreCase({
      expectation: parsed.expectation,
      targets: parsed.targets,
      kept: kept as ScoreableFinding[],
      preGateCount,
    });

    return {
      score,
      kept,
      durationMs: Date.now() - started,
      costUsd: outcome.costUsd ?? null,
      actualOutput: outcome.review,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      score: {
        passed: false,
        expectation: parsed.expectation,
        matchedTargets: 0,
        targetCount: parsed.targets.length,
        matchedFindings: 0,
        findingCount: 0,
        keptCount: 0,
        droppedCount: 0,
      },
      kept: [],
      durationMs: Date.now() - started,
      costUsd: null,
      actualOutput: null,
      error: message,
    };
  }
}

/** Hermetic whole-set helper used by verify:l06 — no DB, no network. */
export async function executeFrozenSet(
  cases: FrozenCase[],
  config: ResolvedReviewerConfig,
  llm: LLMProvider,
): Promise<{ perCase: ExecutedCase[]; metrics: AggregateMetrics }> {
  const perCase: ExecutedCase[] = [];
  for (const c of cases) {
    perCase.push(await executeFrozenCase({ case: c, config, llm }));
  }
  const scored = perCase.filter((r) => !r.error).map((r) => r.score);
  const metrics = aggregate(scored.length > 0 ? scored : perCase.map((r) => r.score));
  return { perCase, metrics };
}
