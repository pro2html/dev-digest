/**
 * Intent-module persistence — owns `pr_intent` and the pull/repo/file reads
 * needed to derive. Keeps `modules/intent` from depending on `ReviewRepository`
 * (reviews → intent stays one-way via run-executor).
 */
import { and, eq } from 'drizzle-orm';
import type { Intent } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { PrIntentMeta } from '../../db/schema/reviews.js';
import type { PullRow } from '../../db/rows.js';

export type IntentRow = {
  intent: Intent;
  meta: PrIntentMeta | null;
};

export class IntentRepository {
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

  async getIntent(prId: string): Promise<IntentRow | undefined> {
    const [row] = await this.db.select().from(t.prIntent).where(eq(t.prIntent.prId, prId));
    if (!row) return undefined;
    return {
      intent: { intent: row.intent, in_scope: row.inScope, out_of_scope: row.outOfScope },
      meta: row.meta ?? null,
    };
  }

  async upsertIntent(prId: string, intent: Intent, meta: PrIntentMeta | null): Promise<void> {
    await this.db
      .insert(t.prIntent)
      .values({
        prId,
        intent: intent.intent,
        inScope: intent.in_scope,
        outOfScope: intent.out_of_scope,
        meta,
      })
      .onConflictDoUpdate({
        target: t.prIntent.prId,
        set: {
          intent: intent.intent,
          inScope: intent.in_scope,
          outOfScope: intent.out_of_scope,
          meta,
        },
      });
  }
}
