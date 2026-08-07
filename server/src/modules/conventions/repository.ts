/**
 * Conventions data-access. Owns read/write to `conventions` table.
 * Workspace-scoped throughout.
 */
import { and, eq, desc, inArray } from 'drizzle-orm';
import type { ConventionCategory, ConventionStatus } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export type ConventionRow = typeof t.conventions.$inferSelect;

export interface InsertConvention {
  workspaceId: string;
  repoId: string;
  rule: string;
  ruleHash: string;
  category: 'naming' | 'error_handling' | 'async' | 'structure' | 'imports' | 'api_contract' | 'testing' | 'logging' | 'types' | 'other';
  appliesTo: string | null;
  evidencePath: string;
  evidenceLine: number | null;
  evidenceSnippet: string;
  confidence: number;
  status: 'pending';
}

export interface RepoBasics {
  id: string;
  fullName: string;
  clonePath: string | null;
}

export class ConventionsRepository {
  constructor(private db: Db) {}

  async getRepo(workspaceId: string, repoId: string): Promise<RepoBasics | undefined> {
    const [row] = await this.db
      .select({
        id: t.repos.id,
        fullName: t.repos.fullName,
        clonePath: t.repos.clonePath,
      })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row ? { id: row.id, fullName: row.fullName, clonePath: row.clonePath } : undefined;
  }

  async list(
    workspaceId: string,
    repoId: string,
    status?: ConventionStatus,
  ): Promise<ConventionRow[]> {
    const conditions = [
      eq(t.conventions.workspaceId, workspaceId),
      eq(t.conventions.repoId, repoId),
    ];
    if (status) conditions.push(eq(t.conventions.status, status));
    return this.db
      .select()
      .from(t.conventions)
      .where(and(...conditions))
      .orderBy(desc(t.conventions.createdAt));
  }

  async ruleHashes(repoId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ hash: t.conventions.ruleHash })
      .from(t.conventions)
      .where(eq(t.conventions.repoId, repoId));
    return new Set(rows.map((r) => r.hash));
  }

  async replacePending(
    workspaceId: string,
    repoId: string,
    rows: InsertConvention[],
  ): Promise<ConventionRow[]> {
    return this.db.transaction(async (tx) => {
      await tx
        .delete(t.conventions)
        .where(
          and(
            eq(t.conventions.workspaceId, workspaceId),
            eq(t.conventions.repoId, repoId),
            eq(t.conventions.status, 'pending'),
          ),
        );

      if (rows.length === 0) return [];

      const inserted = await tx
        .insert(t.conventions)
        .values(rows)
        .onConflictDoNothing()
        .returning();

      return inserted;
    });
  }

  async patch(
    workspaceId: string,
    id: string,
    patch: { rule?: string; category?: ConventionCategory; status?: ConventionStatus },
  ): Promise<ConventionRow | undefined> {
    const set: Record<string, unknown> = {};
    if (patch.rule !== undefined) {
      set.rule = patch.rule;
      set.edited = true;
    }
    if (patch.category !== undefined) set.category = patch.category;
    if (patch.status !== undefined) {
      set.status = patch.status;
      set.accepted = patch.status === 'accepted';
    }
    if (Object.keys(set).length === 0) return undefined;

    const [row] = await this.db
      .update(t.conventions)
      .set(set)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }

  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning({ id: t.conventions.id });
    return rows.length > 0;
  }

  async listByIds(workspaceId: string, ids: string[]): Promise<ConventionRow[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), inArray(t.conventions.id, ids)));
  }

  async attachSkill(workspaceId: string, ids: string[], skillId: string): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(t.conventions)
      .set({ skillId })
      .where(and(eq(t.conventions.workspaceId, workspaceId), inArray(t.conventions.id, ids)));
  }
}
