/**
 * Onboarding persistence. Owns `onboarding` (PK repo_id). Workspace scoping
 * is via the repos row — never return another workspace's json.
 */
import { and, eq } from 'drizzle-orm';
import { Onboarding, type OnboardingSection, type OnboardingTour } from '@devdigest/shared';
import { z } from 'zod';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

const StoredJson = Onboarding.extend({
  files_indexed: z.number().int(),
});

export type RepoBasics = {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  clonePath: string | null;
};

export class OnboardingRepository {
  constructor(private db: Db) {}

  async getRepo(workspaceId: string, repoId: string): Promise<RepoBasics | undefined> {
    const [row] = await this.db
      .select({
        id: t.repos.id,
        owner: t.repos.owner,
        name: t.repos.name,
        fullName: t.repos.fullName,
        clonePath: t.repos.clonePath,
      })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row
      ? {
          id: row.id,
          owner: row.owner,
          name: row.name,
          fullName: row.fullName,
          clonePath: row.clonePath,
        }
      : undefined;
  }

  async getByRepoId(repoId: string): Promise<OnboardingTour | null> {
    const [row] = await this.db.select().from(t.onboarding).where(eq(t.onboarding.repoId, repoId));
    if (!row) return null;
    const parsed = StoredJson.safeParse(row.json);
    if (!parsed.success) {
      return {
        sections: [],
        generated_at: row.generatedAt.toISOString(),
        files_indexed: 0,
      };
    }
    return {
      sections: parsed.data.sections,
      generated_at: row.generatedAt.toISOString(),
      files_indexed: parsed.data.files_indexed,
    };
  }

  async upsert(
    repoId: string,
    sections: OnboardingSection[],
    filesIndexed: number,
  ): Promise<OnboardingTour> {
    const generatedAt = new Date();
    const json = { sections, files_indexed: filesIndexed };
    const [row] = await this.db
      .insert(t.onboarding)
      .values({
        repoId,
        json,
        generatedAt,
      })
      .onConflictDoUpdate({
        target: t.onboarding.repoId,
        set: { json, generatedAt },
      })
      .returning();
    return {
      sections,
      generated_at: (row?.generatedAt ?? generatedAt).toISOString(),
      files_indexed: filesIndexed,
    };
  }

  async updateClonePath(repoId: string, clonePath: string): Promise<void> {
    await this.db
      .update(t.repos)
      .set({ clonePath, lastPolledAt: new Date() })
      .where(eq(t.repos.id, repoId));
  }
}

export const emptyTour = (): OnboardingTour => ({
  sections: [],
  generated_at: null,
  files_indexed: 0,
});
