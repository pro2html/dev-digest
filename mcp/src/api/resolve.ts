import { McpToolError } from '../errors.js';
import type { ApiClient } from './client.js';

export interface RepoRef {
  id: string;
  full_name: string;
}

export interface PullRef {
  id: string;
  number: number;
  title?: string;
}

interface RepoListItem {
  id: string;
  full_name: string;
}

interface PullListItem {
  id: string;
  number: number;
  title?: string;
}

/** Resolve repo UUID → RepoRef via GET /repos (validates workspace membership). */
export async function resolveRepo(api: ApiClient, repoId: string): Promise<RepoRef> {
  const id = repoId.trim();
  const repos = await api.get<RepoListItem[]>('/repos');
  const match = repos.find((r) => r.id === id);
  if (!match) {
    throw new McpToolError(
      'repo_not_found',
      `Repo id '${id}' not found. Import it in the studio or copy the id from GET /repos.`,
    );
  }
  return { id: match.id, full_name: match.full_name };
}

/** Resolve PR number → PR UUID via GET /repos/:id/pulls. */
export async function resolvePull(
  api: ApiClient,
  repoId: string,
  prNumber: number,
): Promise<PullRef> {
  const pulls = await api.get<PullListItem[]>(`/repos/${repoId}/pulls`);
  const match = pulls.find((p) => p.number === prNumber);
  if (!match) {
    throw new McpToolError(
      'pr_not_found',
      `PR #${prNumber} not imported for repo. Open the repo in the studio and import PRs.`,
    );
  }
  return { id: match.id, number: match.number, title: match.title };
}
