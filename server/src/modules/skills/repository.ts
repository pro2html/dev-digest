import { and, asc, count, desc, eq, gte } from 'drizzle-orm';
import type { FindingCategory, SkillType, SkillSource } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import { DEFAULT_SKILL_DESCRIPTION, INITIAL_SKILL_VERSION } from './constants.js';
import { emptyFindingsByCategory } from './helpers.js';

/**
 * Skills data-access. Owns `skills` and `skill_versions`. The `agent_skills`
 * link table is shared with the agents module (agents owns link/reorder; this
 * repo reads it for stats + prompt body resolution). Workspace-scoped throughout.
 */

export type SkillRow = typeof t.skills.$inferSelect;
export type SkillVersionRow = typeof t.skillVersions.$inferSelect;

/** Name + body of an enabled skill linked to an agent (prompt injection). */
export interface SkillBodyRow {
  name: string;
  body: string;
}

export interface InsertSkill {
  workspaceId: string;
  name: string;
  description?: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled?: boolean;
  evidenceFiles?: string[];
}

export interface UpdateSkill {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

export interface SkillStatsRow {
  usedByAgents: number;
  findings30d: number;
  findingsByCategory: Record<FindingCategory, number>;
  agents: Array<{ id: string; name: string }>;
}

export class SkillsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string): Promise<SkillRow[]> {
    return this.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name));
  }

  /** Per-skill link counts for the Skills list cards (`N agents`). */
  async listAgentCounts(workspaceId: string): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        skillId: t.agentSkills.skillId,
        n: count(),
      })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(eq(t.skills.workspaceId, workspaceId))
      .groupBy(t.agentSkills.skillId);
    return new Map(rows.map((r) => [r.skillId, Number(r.n)]));
  }

  async getById(workspaceId: string, id: string): Promise<SkillRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  /** Insert a skill AND record version 1 in skill_versions (immutable snapshot). */
  async insert(values: InsertSkill): Promise<SkillRow> {
    const [row] = await this.db
      .insert(t.skills)
      .values({
        workspaceId: values.workspaceId,
        name: values.name,
        description: values.description ?? DEFAULT_SKILL_DESCRIPTION,
        type: values.type,
        source: values.source,
        body: values.body,
        enabled: values.enabled ?? true,
        version: INITIAL_SKILL_VERSION,
        ...(values.evidenceFiles ? { evidenceFiles: values.evidenceFiles } : {}),
      })
      .returning();
    await this.snapshotVersion(row!, INITIAL_SKILL_VERSION);
    return row!;
  }

  /**
   * Update a skill. Only a `body` change bumps `version` and snapshots into
   * skill_versions (name/description/type/enabled do not).
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkill,
  ): Promise<SkillRow | undefined> {
    const existing = await this.getById(workspaceId, id);
    if (!existing) return undefined;

    const bodyChanged = patch.body !== undefined && patch.body !== existing.body;
    const nextVersion = bodyChanged ? existing.version + 1 : existing.version;

    const [row] = await this.db
      .update(t.skills)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(bodyChanged ? { version: nextVersion } : {}),
      })
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning();

    if (bodyChanged && row) await this.snapshotVersion(row, nextVersion);
    return row;
  }

  /** Delete a skill (scoped to workspace). agent_skills / skill_versions cascade. */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  private async snapshotVersion(row: SkillRow, version: number): Promise<void> {
    await this.db
      .insert(t.skillVersions)
      .values({
        skillId: row.id,
        version,
        body: row.body,
      })
      .onConflictDoNothing();
  }

  // ---- skill_versions -------------------------------------------------------

  /** All body snapshots for a skill, newest version first. */
  async listVersions(skillId: string): Promise<SkillVersionRow[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  async getVersion(skillId: string, version: number): Promise<SkillVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skillVersions)
      .where(and(eq(t.skillVersions.skillId, skillId), eq(t.skillVersions.version, version)));
    return row;
  }

  // ---- prompt injection + stats ---------------------------------------------

  /**
   * Enabled skill bodies linked to an agent, in link `order` ascending.
   * Only rows where BOTH `skills.enabled` and `agent_skills.enabled` are true.
   */
  async bodiesForAgent(agentId: string): Promise<SkillBodyRow[]> {
    return this.db
      .select({ name: t.skills.name, body: t.skills.body })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(
        and(
          eq(t.agentSkills.agentId, agentId),
          eq(t.agentSkills.enabled, true),
          eq(t.skills.enabled, true),
        ),
      )
      .orderBy(asc(t.agentSkills.order));
  }

  /**
   * Aggregate stats for a skill.
   *
   * `findings_30d` / `findings_by_category` attribution is approximate: findings
   * from reviews by agents that currently have this skill linked and enabled —
   * attributed at the agent level, not the skill. Replace with a `skill_usage`
   * table when precise per-skill telemetry is needed.
   */
  async stats(skillId: string): Promise<SkillStatsRow> {
    const agentRows = await this.db
      .select({ id: t.agents.id, name: t.agents.name })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(eq(t.agentSkills.skillId, skillId))
      .orderBy(asc(t.agents.name));

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const categoryRows = await this.db
      .select({
        category: t.findings.category,
        n: count(),
      })
      .from(t.findings)
      .innerJoin(t.reviews, eq(t.findings.reviewId, t.reviews.id))
      .innerJoin(
        t.agentSkills,
        and(
          eq(t.agentSkills.agentId, t.reviews.agentId),
          eq(t.agentSkills.skillId, skillId),
          eq(t.agentSkills.enabled, true),
        ),
      )
      .where(gte(t.reviews.createdAt, since))
      .groupBy(t.findings.category);

    const findingsByCategory = emptyFindingsByCategory();
    let findings30d = 0;
    for (const row of categoryRows) {
      const cat = row.category as FindingCategory;
      if (cat in findingsByCategory) {
        findingsByCategory[cat] = Number(row.n);
        findings30d += Number(row.n);
      }
    }

    return {
      usedByAgents: agentRows.length,
      findings30d,
      findingsByCategory,
      agents: agentRows,
    };
  }
}
