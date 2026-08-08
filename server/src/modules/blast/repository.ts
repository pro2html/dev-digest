/**
 * Blast persistence — workspace-scoped pull + pr_files + prior-PR overlap.
 * Compute-on-read; no dedicated blast table.
 *
 * Owns its own Drizzle reads (same pattern as smart-diff / intent) so blast
 * does not import ReviewRepository or create peer-module cycles.
 */
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { BlastPriorPr } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { PullRow } from '../../db/rows.js';
import { MAX_OVERLAP_PATHS, MAX_PRIOR_PRS } from './constants.js';

export class BlastRepository {
  constructor(private db: Db) {}

  getPull(workspaceId: string, prId: string): Promise<PullRow | undefined> {
    return this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)))
      .then((rows) => rows[0]);
  }

  getPrFiles(prId: string): Promise<(typeof t.prFiles.$inferSelect)[]> {
    return this.db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId));
  }

  /**
   * Other PRs in the same repo whose `pr_files` intersect `paths`.
   * Prefer merged → closed → open; then by overlap size, then recency.
   */
  async findPriorPrsOverlappingFiles(
    repoId: string,
    excludePrId: string,
    paths: string[],
    limit: number = MAX_PRIOR_PRS,
  ): Promise<BlastPriorPr[]> {
    if (paths.length === 0 || limit <= 0) return [];

    const overlapCount = sql<number>`count(*)::int`;
    const rows = await this.db
      .select({
        prId: t.pullRequests.id,
        number: t.pullRequests.number,
        title: t.pullRequests.title,
        author: t.pullRequests.author,
        status: t.pullRequests.status,
        updatedAt: t.pullRequests.updatedAt,
        openedAt: t.pullRequests.openedAt,
        overlapCount,
      })
      .from(t.prFiles)
      .innerJoin(t.pullRequests, eq(t.prFiles.prId, t.pullRequests.id))
      .where(
        and(
          eq(t.pullRequests.repoId, repoId),
          ne(t.pullRequests.id, excludePrId),
          inArray(t.prFiles.path, paths),
        ),
      )
      .groupBy(
        t.pullRequests.id,
        t.pullRequests.number,
        t.pullRequests.title,
        t.pullRequests.author,
        t.pullRequests.status,
        t.pullRequests.updatedAt,
        t.pullRequests.openedAt,
      )
      .orderBy(
        sql`case
          when ${t.pullRequests.status} = 'merged' then 0
          when ${t.pullRequests.status} = 'closed' then 1
          else 2
        end`,
        desc(overlapCount),
        sql`coalesce(${t.pullRequests.updatedAt}, ${t.pullRequests.openedAt}) desc nulls last`,
      )
      .limit(limit);

    if (rows.length === 0) return [];

    const prIds = rows.map((r) => r.prId);
    const fileRows = await this.db
      .select({ prId: t.prFiles.prId, path: t.prFiles.path })
      .from(t.prFiles)
      .where(and(inArray(t.prFiles.prId, prIds), inArray(t.prFiles.path, paths)));

    const overlapByPr = new Map<string, string[]>();
    for (const f of fileRows) {
      const arr = overlapByPr.get(f.prId) ?? [];
      arr.push(f.path);
      overlapByPr.set(f.prId, arr);
    }

    return rows.map((r) => {
      const all = [...new Set(overlapByPr.get(r.prId) ?? [])].sort();
      const touched = r.updatedAt ?? r.openedAt;
      return {
        pr_id: r.prId,
        pr_number: r.number,
        title: r.title,
        author: r.author,
        status: r.status,
        touched_at: touched ? touched.toISOString() : null,
        files_overlap: all.slice(0, MAX_OVERLAP_PATHS),
        overlap_count: Number(r.overlapCount) || all.length,
      };
    });
  }
}
