import { describe, expect, it } from 'vitest';
import { AppError } from '../src/platform/errors.js';
import { rejectAgentSelectionForSkill } from '../src/modules/evals/reviewer-config.js';

describe('rejectAgentSelectionForSkill', () => {
  it('rejects an agent selection on a skill-owned run (AC-53)', () => {
    expect(() =>
      rejectAgentSelectionForSkill('skill', { agent_id: '11111111-1111-1111-1111-111111111111' }),
    ).toThrow(AppError);
    try {
      rejectAgentSelectionForSkill('skill', { agent_id: '11111111-1111-1111-1111-111111111111' });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('agent_selection_not_allowed');
    }
  });

  it('allows a skill run without an agent id (AC-53, AC-54)', () => {
    expect(() => rejectAgentSelectionForSkill('skill', {})).not.toThrow();
    expect(() => rejectAgentSelectionForSkill('agent', { agent_id: 'x' })).not.toThrow();
  });
});
