/**
 * Multi-agent persistence. Owns `multi_agent_runs` plus read-only joins to
 * pulls / agent_runs / reviews / findings. Does not import reviews/repository.
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import type { AgentRunRow, FindingRow, PullRow } from '../../db/rows.js';
import * as t from '../../db/schema.js';

type ReviewRow = typeof t.reviews.$inferSelect;
export type ParentRow = typeof t.multiAgentRuns.$inferSelect;

export class MultiAgentRepository {
  constructor(private db: Db) {}

  getPull(workspaceId: string, prId: string): Promise<PullRow | undefined> {
    return this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)))
      .then((rows) => rows[0]);
  }

  async insertParent(values: { workspaceId: string; prId: string }): Promise<ParentRow> {
    const [row] = await this.db
      .insert(t.multiAgentRuns)
      .values({
        workspaceId: values.workspaceId,
        prId: values.prId,
        childRunIds: [],
      })
      .returning();
    return row!;
  }

  async setChildRunIds(id: string, childRunIds: string[]): Promise<void> {
    await this.db.update(t.multiAgentRuns).set({ childRunIds }).where(eq(t.multiAgentRuns.id, id));
  }

  async deleteParent(id: string): Promise<void> {
    await this.db.delete(t.multiAgentRuns).where(eq(t.multiAgentRuns.id, id));
  }

  async listByPr(workspaceId: string, prId: string): Promise<ParentRow[]> {
    return this.db
      .select()
      .from(t.multiAgentRuns)
      .where(and(eq(t.multiAgentRuns.workspaceId, workspaceId), eq(t.multiAgentRuns.prId, prId)))
      .orderBy(desc(t.multiAgentRuns.ranAt));
  }

  async getLatestByPr(workspaceId: string, prId: string): Promise<ParentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.multiAgentRuns)
      .where(and(eq(t.multiAgentRuns.workspaceId, workspaceId), eq(t.multiAgentRuns.prId, prId)))
      .orderBy(desc(t.multiAgentRuns.ranAt))
      .limit(1);
    return row;
  }

  async getById(workspaceId: string, id: string): Promise<ParentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.multiAgentRuns)
      .where(and(eq(t.multiAgentRuns.id, id), eq(t.multiAgentRuns.workspaceId, workspaceId)));
    return row;
  }

  async getAgentRunsByIds(workspaceId: string, ids: string[]): Promise<AgentRunRow[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(t.agentRuns)
      .where(and(eq(t.agentRuns.workspaceId, workspaceId), inArray(t.agentRuns.id, ids)));
  }

  async reviewsForRunIds(
    runIds: string[],
  ): Promise<Map<string, { review: ReviewRow; findings: FindingRow[] }>> {
    const out = new Map<string, { review: ReviewRow; findings: FindingRow[] }>();
    if (runIds.length === 0) return out;
    const reviewRows = await this.db.select().from(t.reviews).where(inArray(t.reviews.runId, runIds));
    if (reviewRows.length === 0) return out;
    const findings = await this.db
      .select()
      .from(t.findings)
      .where(
        inArray(
          t.findings.reviewId,
          reviewRows.map((r) => r.id),
        ),
      );
    for (const review of reviewRows) {
      if (!review.runId) continue;
      out.set(review.runId, {
        review,
        findings: findings.filter((f) => f.reviewId === review.id),
      });
    }
    return out;
  }

  async completedRunsForWorkspace(
    workspaceId: string,
  ): Promise<{ agentId: string | null; status: string | null; durationMs: number | null; costUsd: number | null }[]> {
    return this.db
      .select({
        agentId: t.agentRuns.agentId,
        status: t.agentRuns.status,
        durationMs: t.agentRuns.durationMs,
        costUsd: t.agentRuns.costUsd,
      })
      .from(t.agentRuns)
      .where(eq(t.agentRuns.workspaceId, workspaceId));
  }
}
