/**
 * Multi-agent parent runs: start via ReviewService, read/assemble from stored child ids.
 */
import type { MultiAgentRun } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import type { AgentRow } from '../../db/rows.js';
import { ReviewService } from '../reviews/service.js';
import type { Logger } from '../reviews/run-executor.js';
import type { AgentReviewEstimate, MultiAgentGetEnvelope, MultiAgentListEnvelope } from './dto.js';
import { assembleMultiAgentRun, assertStartAgents, averageCompletedEstimates } from './helpers.js';
import { MultiAgentRepository, type ParentRow } from './repository.js';

export class MultiAgentService {
  private repo: MultiAgentRepository;
  private reviews: ReviewService;

  constructor(private container: Container) {
    this.repo = new MultiAgentRepository(container.db);
    this.reviews = new ReviewService(container);
  }

  async start(
    workspaceId: string,
    prId: string,
    agentIds: string[],
    logger?: Logger,
  ): Promise<MultiAgentRun> {
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');

    const found: AgentRow[] = [];
    for (const id of agentIds) {
      const agent = await this.container.agentsRepo.getById(workspaceId, id);
      if (agent) found.push(agent);
    }
    const targets = assertStartAgents(agentIds, found);

    const parent = await this.repo.insertParent({ workspaceId, prId });
    try {
      const { runs } = await this.reviews.runReview(workspaceId, prId, targets, logger);
      const childIds = runs.map((r) => r.run_id);
      await this.repo.setChildRunIds(parent.id, childIds);
      parent.childRunIds = childIds;
    } catch (err) {
      await this.repo.deleteParent(parent.id);
      throw err;
    }

    const assembled = await this.assemble(workspaceId, parent, pull.number);
    if (!assembled.run) {
      throw new NotFoundError('Multi-agent run not found');
    }
    return assembled.run;
  }

  async getLatest(workspaceId: string, prId: string): Promise<MultiAgentGetEnvelope> {
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const parent = await this.repo.getLatestByPr(workspaceId, prId);
    if (!parent) {
      return { pr_id: prId, run: null, grouped_locations: [] };
    }
    return this.assemble(workspaceId, parent, pull.number);
  }

  async getById(workspaceId: string, id: string): Promise<MultiAgentGetEnvelope> {
    const parent = await this.repo.getById(workspaceId, id);
    if (!parent) throw new NotFoundError('Multi-agent run not found');
    const pull = await this.repo.getPull(workspaceId, parent.prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    return this.assemble(workspaceId, parent, pull.number);
  }

  async listForPull(workspaceId: string, prId: string): Promise<MultiAgentListEnvelope> {
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const parents = await this.repo.listByPr(workspaceId, prId);
    const runs: MultiAgentRun[] = [];
    for (const parent of parents) {
      const assembled = await this.assemble(workspaceId, parent, pull.number);
      if (assembled.run) runs.push(assembled.run);
    }
    return { pr_id: prId, runs };
  }

  async estimates(workspaceId: string): Promise<AgentReviewEstimate[]> {
    const agents = await this.container.agentsRepo.list(workspaceId);
    const runs = await this.repo.completedRunsForWorkspace(workspaceId);
    return agents.map((agent) => {
      const avg = averageCompletedEstimates(runs.filter((r) => r.agentId === agent.id));
      return { agent_id: agent.id, ...avg };
    });
  }

  private async assemble(
    workspaceId: string,
    parent: ParentRow,
    prNumber: number,
  ): Promise<MultiAgentGetEnvelope> {
    const childIds = parent.childRunIds ?? [];
    const childRuns = await this.repo.getAgentRunsByIds(workspaceId, childIds);
    const reviewsByRunId = await this.repo.reviewsForRunIds(childIds);
    const agentById = new Map<string, AgentRow>();
    for (const run of childRuns) {
      if (!run.agentId || agentById.has(run.agentId)) continue;
      const agent = await this.container.agentsRepo.getById(workspaceId, run.agentId);
      if (agent) agentById.set(agent.id, agent);
    }
    const { run, grouped_locations } = assembleMultiAgentRun({
      parent: {
        id: parent.id,
        prId: parent.prId,
        ranAt: parent.ranAt,
        childRunIds: childIds,
      },
      prNumber,
      childRuns,
      reviewsByRunId,
      agentById,
    });
    return { pr_id: parent.prId, run, grouped_locations };
  }
}
