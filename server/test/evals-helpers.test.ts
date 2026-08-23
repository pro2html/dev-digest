import { describe, it, expect } from 'vitest';
import { draftFromFinding } from '../src/modules/evals/helpers.js';
import type { FindingForEval } from '../src/modules/evals/repository.js';

const FINDING: FindingForEval = {
  id: '11111111-1111-4111-8111-111111111111',
  file: 'src/a.ts',
  startLine: 2,
  endLine: 15,
  severity: 'CRITICAL',
  category: 'security',
  title: 'Hardcoded secret',
  acceptedAt: new Date('2026-08-01T00:00:00.000Z'),
  dismissedAt: null,
  reviewAgentId: '22222222-2222-4222-8222-222222222222',
  prId: '33333333-3333-4333-8333-333333333333',
  prTitle: 'Add Stripe',
  prBody: '',
  patch: 'diff --git a/src/a.ts b/src/a.ts\n',
};

describe('draftFromFinding', () => {
  it('copies the finding line range into expected_output and the draft', () => {
    const draft = draftFromFinding(FINDING);
    expect(draft.start_line).toBe(2);
    expect(draft.end_line).toBe(15);
    expect(draft.expected_output).toMatchObject({
      expectation: 'must_find',
      findings: [
        {
          file: 'src/a.ts',
          start_line: 2,
          end_line: 15,
        },
      ],
    });
  });
});
