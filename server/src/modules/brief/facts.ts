/**
 * Collect Why+Risk Brief writer facts. Diff stats only — never patch bodies
 * or Intent hunk headers. Specs are read only when a cited path is safe and
 * present. Linked issue is a local copy of Intent's private best-effort fetch
 * (do not import intent/sources).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GitHubClient, Intent, IssueMeta, PrBlastRecord, PrIntentRecord } from '@devdigest/shared';
import {
  MAX_BLAST_CHARS,
  MAX_INTENT_CHARS,
  MAX_ISSUE_CHARS,
  MAX_SPEC_CHARS,
  MAX_SPEC_FILES,
  MAX_TOTAL_CHARS,
} from './constants.js';
import { isPathSafe, toPosixRel, truncate } from './helpers.js';

export type DiffStatFile = {
  path: string;
  additions: number | null;
  deletions: number | null;
};

export type BriefFacts = {
  block: string;
  changedPaths: string[];
  blastEndpoints: string[];
};

const SPEC_CANDIDATE_RE =
  /(?:^|\s)((?:[\w.-]+\/)*[\w.-]+\.(?:md|txt|rst))(?=\s|$|[),])/gi;

function looksLikeSpec(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    /(?:^|\/)(?:docs\/)?(?:plans?|specs?|design|adr|rfcs?|insights)\//.test(lower) ||
    /(?:^|\/)(?:specs?|docs|insights)\//.test(lower) ||
    /(?:plan|spec|design|proposal|rfc)/.test(lower)
  );
}

/** Best-effort extract repo-relative spec/plan paths from markdown text. */
export function extractSpecCandidates(text: string): string[] {
  const found = new Set<string>();
  const mdLink = /\[([^\]]*)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdLink.exec(text))) {
    const href = (m[2] ?? '').trim();
    if (!href || /^https?:\/\//i.test(href) || href.startsWith('#')) continue;
    const path = href.replace(/^\.?\//, '').split(/[?#]/)[0]!;
    if (looksLikeSpec(path)) found.add(path);
  }
  const bare = text.match(SPEC_CANDIDATE_RE) ?? [];
  for (const raw of bare) {
    const path = raw.trim().replace(/^\.?\//, '');
    if (looksLikeSpec(path)) found.add(path);
  }
  return [...found].slice(0, MAX_SPEC_FILES);
}

export function collectBlastEndpoints(blast: PrBlastRecord): string[] {
  const out = new Set<string>();
  for (const d of blast.downstream) {
    for (const e of d.endpoints_affected) {
      if (e.trim()) out.add(e.trim());
    }
  }
  return [...out];
}

export function collectBlastNames(blast: PrBlastRecord): string[] {
  const names: string[] = [];
  for (const s of blast.changed_symbols) {
    names.push(`${s.name} (${s.file})`);
  }
  for (const d of blast.downstream) {
    for (const c of d.callers) {
      names.push(`${c.name} @ ${c.file}`);
    }
    for (const cron of d.crons_affected) {
      if (cron.trim()) names.push(`cron: ${cron.trim()}`);
    }
  }
  return names;
}

/**
 * Linked issue: GitHub PR `linked_issue`, else body `#N`. 404/timeout → omit.
 * Copied locally — do not import intent/sources (that file also extracts hunk
 * headers, which this writer must not send).
 */
export async function fetchLinkedIssueBestEffort(
  github: GitHubClient,
  owner: string,
  name: string,
  prNumber: number,
  body: string | null,
): Promise<IssueMeta | null> {
  try {
    const detail = await github.getPullRequest({ owner, name }, prNumber);
    if (detail.linked_issue) return detail.linked_issue;
  } catch {
    /* fall through to body-only parse + getIssue */
  }
  const m = (body ?? '').match(/(?:closes|fixes|resolves)?\s*#(\d+)/i);
  if (!m?.[1]) return null;
  try {
    return await github.getIssue({ owner, name }, Number(m[1]));
  } catch {
    return null;
  }
}

async function readCitedSpecs(
  clonePath: string | null | undefined,
  bodies: string[],
): Promise<string[]> {
  if (!clonePath) return [];
  const candidates = new Set<string>();
  for (const body of bodies) {
    for (const p of extractSpecCandidates(body)) candidates.add(p);
  }
  const excerpts: string[] = [];
  for (const rel of candidates) {
    if (excerpts.length >= MAX_SPEC_FILES) break;
    const posix = toPosixRel(rel);
    if (!posix || !isPathSafe(posix, clonePath)) continue;
    try {
      const raw = await readFile(join(clonePath, posix), 'utf8');
      excerpts.push(`# ${posix}\n${truncate(raw, MAX_SPEC_CHARS)}`);
    } catch {
      /* skip unreadable */
    }
  }
  return excerpts;
}

function intentSection(intent: Intent | PrIntentRecord): string {
  const text = [
    `intent: ${intent.intent}`,
    `in_scope: ${(intent.in_scope ?? []).join('; ')}`,
    `out_of_scope: ${(intent.out_of_scope ?? []).join('; ')}`,
  ].join('\n');
  return `# Intent\n${truncate(text, MAX_INTENT_CHARS)}`;
}

function blastSection(blast: PrBlastRecord): string {
  const endpoints = collectBlastEndpoints(blast);
  const names = collectBlastNames(blast);
  const text = [
    `status: ${blast.status}`,
    blast.reason ? `reason: ${blast.reason}` : null,
    `summary: ${blast.summary}`,
    endpoints.length ? `endpoints:\n${endpoints.map((e) => `- ${e}`).join('\n')}` : 'endpoints: (none)',
    names.length ? `names:\n${names.map((n) => `- ${n}`).join('\n')}` : 'names: (none)',
  ]
    .filter((line): line is string => line != null)
    .join('\n');
  return `# Blast\n${truncate(text, MAX_BLAST_CHARS)}`;
}

/** Path + addition/deletion counts only. Never `patch` text. */
export function diffStatsSection(files: DiffStatFile[]): string {
  const lines = files.map((f) => {
    const a = f.additions ?? 0;
    const d = f.deletions ?? 0;
    return `- ${f.path} (+${a}/-${d})`;
  });
  return `# Diff stats (${files.length} files)\n${lines.length ? lines.join('\n') : '(none)'}`;
}

function issueSection(issue: IssueMeta): string {
  const body = truncate(issue.body ?? '', MAX_ISSUE_CHARS);
  return (
    `# Linked issue #${issue.number}\n` +
    `title: ${issue.title}\n` +
    `state: ${issue.state}\n` +
    (body ? `body:\n${body}` : 'body: (empty)')
  );
}

export async function collectFacts(input: {
  intent: Intent | PrIntentRecord;
  blast: PrBlastRecord;
  files: DiffStatFile[];
  issue: IssueMeta | null;
  prBody: string | null | undefined;
  clonePath: string | null | undefined;
}): Promise<BriefFacts> {
  const sections: string[] = [
    intentSection(input.intent),
    blastSection(input.blast),
    diffStatsSection(input.files),
  ];

  if (input.issue) {
    sections.push(issueSection(input.issue));
  }

  const specBodies = [input.prBody ?? '', input.issue?.body ?? ''].filter(Boolean);
  const specs = await readCitedSpecs(input.clonePath, specBodies);
  if (specs.length) {
    sections.push(`# Specs (read)\n${specs.join('\n\n')}`);
  }

  const block = truncate(sections.join('\n\n'), MAX_TOTAL_CHARS);
  return {
    block,
    changedPaths: input.files.map((f) => toPosixRel(f.path)).filter(Boolean),
    blastEndpoints: collectBlastEndpoints(input.blast),
  };
}
