/**
 * Why+Risk Brief persistence. Owns `pr_brief` (PK pr_id). Workspace scoping
 * is via the pull row — never return another workspace's json.
 */
import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import type { PullRow } from '../../db/rows.js';
import * as t from '../../db/schema.js';
import { StoredBriefJson, type StoredBrief } from './mapper.js';

export class BriefRepository {
  constructor(private db: Db) {}

  getPull(workspaceId: string, prId: string): Promise<PullRow | undefined> {
    return this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)))
      .then((rows) => rows[0]);
  }

  getRepo(repoId: string): Promise<typeof t.repos.$inferSelect | undefined> {
    return this.db
      .select()
      .from(t.repos)
      .where(eq(t.repos.id, repoId))
      .then((rows) => rows[0]);
  }

  getPrFiles(prId: string): Promise<(typeof t.prFiles.$inferSelect)[]> {
    return this.db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId));
  }

  async getByPrId(prId: string): Promise<StoredBrief | null> {
    const [row] = await this.db.select().from(t.prBrief).where(eq(t.prBrief.prId, prId));
    if (!row) return null;
    const parsed = StoredBriefJson.safeParse(row.json);
    return parsed.success ? parsed.data : null;
  }

  async upsert(prId: string, stored: StoredBrief): Promise<StoredBrief> {
    await this.db
      .insert(t.prBrief)
      .values({ prId, json: stored })
      .onConflictDoUpdate({
        target: t.prBrief.prId,
        set: { json: stored },
      });
    return stored;
  }
}
