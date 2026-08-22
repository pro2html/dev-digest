import type { Provider, ReviewStrategy } from '@devdigest/shared';

/** Fixed reviewer baseline for every skill-owned eval run (AC-51, AC-52). */
export const SKILL_BASELINE = {
  provider: 'openrouter' as Provider,
  model: 'deepseek/deepseek-v4-flash',
  strategy: 'single-pass' as ReviewStrategy,
  systemPrompt:
    'You are a careful code reviewer. Apply only the attached skill. Report grounded findings; do not invent files or lines that are not in the diff.',
  label: 'skill-baseline-v1',
} as const;

export const IN_FLIGHT_STATUSES = ['queued', 'running'] as const;

export const COMPLETE_STATUS = 'complete' as const;
