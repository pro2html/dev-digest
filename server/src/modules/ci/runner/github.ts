import type { GitHubReviewPayload, UnifiedDiff } from '@devdigest/shared';
import { parseUnifiedDiff, wrapFilePatch } from '../../../adapters/git/diff-parser.js';

export interface GithubFile {
  filename: string;
  patch?: string;
}

export async function githubJson(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'devdigest-ci-runner',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`github ${res.status} ${path}`);
  return res.json();
}

/** Reconstruct a UnifiedDiff from GitHub's hunk-only `files[].patch` (same wrap as studio). */
export function diffFromGithubFiles(files: GithubFile[]): UnifiedDiff {
  const parts: string[] = [];
  for (const f of files) {
    if (!f.patch) continue;
    parts.push(wrapFilePatch(f.filename, f.patch).replace(/\n$/u, ''));
  }
  return parseUnifiedDiff(parts.join('\n'));
}

export async function postGithubReview(
  owner: string,
  name: string,
  prNumber: number,
  commitId: string,
  payload: GitHubReviewPayload,
): Promise<void> {
  await githubJson(`/repos/${owner}/${name}/pulls/${prNumber}/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      commit_id: commitId,
      body: payload.body,
      event: payload.event,
      ...(payload.comments?.length
        ? {
            comments: payload.comments.map((c) => ({
              path: c.path,
              line: c.line,
              body: c.body,
              side: 'RIGHT',
            })),
          }
        : {}),
    }),
  });
}

export async function postPrComment(
  owner: string,
  name: string,
  prNumber: number,
  body: string,
): Promise<void> {
  await githubJson(`/repos/${owner}/${name}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}
