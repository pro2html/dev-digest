/**
 * Smart Diff persistence — pull + pr_files + latest-review findings.
 * Compute-on-read only; no dedicated smart-diff table.
 *
 * Owns its own Drizzle reads (same pattern as intent/) so smart-diff does not
 * import IntentService or create a reviews ↔ smart-diff cycle.
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { PullRow } from '../../db/rows.js';

export type FindingLineRow = { file: string; startLine: number };

export class SmartDiffRepository {
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
   * Findings from the newest review only (reviews ordered created_at desc).
   * Simpler than union-by-run_id; sufficient for MVP / single-agent demos.
   */
  async getLatestReviewFindingLines(prId: string): Promise<FindingLineRow[]> {
    const [latest] = await this.db
      .select({ id: t.reviews.id })
      .from(t.reviews)
      .where(eq(t.reviews.prId, prId))
      .orderBy(desc(t.reviews.createdAt))
      .limit(1);
    if (!latest) return [];

    return this.db
      .select({ file: t.findings.file, startLine: t.findings.startLine })
      .from(t.findings)
      .where(eq(t.findings.reviewId, latest.id));
  }

  /** Convenience for tests / future: findings for many review ids. */
  getFindingLinesForReviews(reviewIds: string[]): Promise<FindingLineRow[]> {
    if (reviewIds.length === 0) return Promise.resolve([]);
    return this.db
      .select({ file: t.findings.file, startLine: t.findings.startLine })
      .from(t.findings)
      .where(inArray(t.findings.reviewId, reviewIds));
  }
}
