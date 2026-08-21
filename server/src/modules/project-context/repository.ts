/**
 * Project-context data-access. Owns attachment join tables and workspace-scoped
 * repo/agent/skill lookups used by this module. Reviews may call this repository;
 * this module must not import ReviewRepository.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export type RepoBasics = {
  id: string;
  clonePath: string | null;
};

export type OrderedDoc = { path: string; order: number };

export type SkillDocsGroup = { skillId: string; paths: OrderedDoc[] };

export class ProjectContextRepository {
  constructor(private db: Db) {}

  async getRepo(workspaceId: string, repoId: string): Promise<RepoBasics | undefined> {
    const [row] = await this.db
      .select({ id: t.repos.id, clonePath: t.repos.clonePath })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row;
  }

  async listAgentDocs(agentId: string): Promise<OrderedDoc[]> {
    const rows = await this.db
      .select({ path: t.agentContextDocs.path, order: t.agentContextDocs.order })
      .from(t.agentContextDocs)
      .where(eq(t.agentContextDocs.agentId, agentId))
      .orderBy(asc(t.agentContextDocs.order), asc(t.agentContextDocs.path));
    return rows;
  }

  async listSkillDocs(skillId: string): Promise<OrderedDoc[]> {
    const rows = await this.db
      .select({ path: t.skillContextDocs.path, order: t.skillContextDocs.order })
      .from(t.skillContextDocs)
      .where(eq(t.skillContextDocs.skillId, skillId))
      .orderBy(asc(t.skillContextDocs.order), asc(t.skillContextDocs.path));
    return rows;
  }

  /** Replace the full attachment list. Does not bump agents.version / skills.version. */
  async setAgentDocs(agentId: string, docs: OrderedDoc[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(t.agentContextDocs).where(eq(t.agentContextDocs.agentId, agentId));
      if (docs.length === 0) return;
      await tx.insert(t.agentContextDocs).values(
        docs.map((d) => ({ agentId, path: d.path, order: d.order })),
      );
    });
  }

  async setSkillDocs(skillId: string, docs: OrderedDoc[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(t.skillContextDocs).where(eq(t.skillContextDocs.skillId, skillId));
      if (docs.length === 0) return;
      await tx.insert(t.skillContextDocs).values(
        docs.map((d) => ({ skillId, path: d.path, order: d.order })),
      );
    });
  }

  /**
   * Skill attachments for globally-enabled + link-enabled skills, in agent
   * skill-link order.
   */
  async listEnabledSkillDocsForAgent(agentId: string): Promise<SkillDocsGroup[]> {
    const links = await this.db
      .select({
        skillId: t.agentSkills.skillId,
        linkOrder: t.agentSkills.order,
      })
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

    if (links.length === 0) return [];

    const skillIds = links.map((l) => l.skillId);
    const docs = await this.db
      .select({
        skillId: t.skillContextDocs.skillId,
        path: t.skillContextDocs.path,
        order: t.skillContextDocs.order,
      })
      .from(t.skillContextDocs)
      .where(inArray(t.skillContextDocs.skillId, skillIds))
      .orderBy(asc(t.skillContextDocs.order), asc(t.skillContextDocs.path));

    const bySkill = new Map<string, OrderedDoc[]>();
    for (const d of docs) {
      const arr = bySkill.get(d.skillId) ?? [];
      arr.push({ path: d.path, order: d.order });
      bySkill.set(d.skillId, arr);
    }
    return links.map((l) => ({ skillId: l.skillId, paths: bySkill.get(l.skillId) ?? [] }));
  }

  /**
   * Distinct workspace agents that attach `path` directly or via an
   * enabled+linked skill that attaches it (AC-04).
   */
  async usedByCounts(workspaceId: string, paths: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (paths.length === 0) return result;

    const direct = await this.db
      .select({
        path: t.agentContextDocs.path,
        agentId: t.agentContextDocs.agentId,
      })
      .from(t.agentContextDocs)
      .innerJoin(t.agents, eq(t.agentContextDocs.agentId, t.agents.id))
      .where(and(eq(t.agents.workspaceId, workspaceId), inArray(t.agentContextDocs.path, paths)));

    const inherited = await this.db
      .select({
        path: t.skillContextDocs.path,
        agentId: t.agentSkills.agentId,
      })
      .from(t.skillContextDocs)
      .innerJoin(t.skills, eq(t.skillContextDocs.skillId, t.skills.id))
      .innerJoin(t.agentSkills, eq(t.agentSkills.skillId, t.skills.id))
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(
        and(
          eq(t.agents.workspaceId, workspaceId),
          eq(t.skills.enabled, true),
          eq(t.agentSkills.enabled, true),
          inArray(t.skillContextDocs.path, paths),
        ),
      );

    const byPath = new Map<string, Set<string>>();
    for (const row of [...direct, ...inherited]) {
      let set = byPath.get(row.path);
      if (!set) {
        set = new Set();
        byPath.set(row.path, set);
      }
      set.add(row.agentId);
    }
    for (const p of paths) {
      result.set(p, byPath.get(p)?.size ?? 0);
    }
    return result;
  }
}
