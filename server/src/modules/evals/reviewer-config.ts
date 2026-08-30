import type { Provider, ReviewStrategy } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import { resolveSkillBodiesForPrompt } from '../skills/helpers.js';
import { SKILL_BASELINE } from './constants.js';
import type { EvalOwnerKind } from '@devdigest/shared';

export type ResolvedReviewerConfig = {
  provider: Provider;
  model: string;
  strategy: ReviewStrategy;
  systemPrompt: string;
  skillBodies: string[];
  ownerVersion: number;
  baselineLabel: string | null;
};

export async function resolveReviewerConfig(
  container: Container,
  workspaceId: string,
  ownerKind: EvalOwnerKind,
  ownerId: string,
): Promise<ResolvedReviewerConfig> {
  if (ownerKind === 'skill') {
    const skill = await container.skillsRepo.getById(workspaceId, ownerId);
    if (!skill) throw new NotFoundError('Skill not found');
    const skillBodies = resolveSkillBodiesForPrompt([
      {
        name: skill.name,
        body: skill.body,
        skillEnabled: true,
        linkEnabled: true,
        order: 0,
      },
    ]);
    return {
      provider: SKILL_BASELINE.provider,
      model: SKILL_BASELINE.model,
      strategy: SKILL_BASELINE.strategy,
      systemPrompt: SKILL_BASELINE.systemPrompt,
      skillBodies,
      ownerVersion: skill.version,
      baselineLabel: SKILL_BASELINE.label,
    };
  }

  const agent = await container.agentsRepo.getById(workspaceId, ownerId);
  if (!agent) throw new NotFoundError('Agent not found');
  const skillRows = await container.skillsRepo.bodiesForAgent(agent.id);
  const skillBodies = resolveSkillBodiesForPrompt(
    skillRows.map((s, order) => ({
      name: s.name,
      body: s.body,
      skillEnabled: true,
      linkEnabled: true,
      order,
    })),
  );
  return {
    provider: agent.provider,
    model: agent.model,
    strategy: agent.strategy,
    systemPrompt: agent.systemPrompt,
    skillBodies,
    ownerVersion: agent.version,
    baselineLabel: null,
  };
}

export function rejectAgentSelectionForSkill(
  ownerKind: EvalOwnerKind,
  body: { agent_id?: unknown } | undefined,
): void {
  if (ownerKind === 'skill' && body && body.agent_id != null) {
    throw new AppError(
      'agent_selection_not_allowed',
      'Skill-owned evals do not accept an agent selection',
      400,
    );
  }
}
