/**
 * Build classifier input for PR intent — title, body, linked issue (best-effort),
 * plan/spec (only if read OK), file list, hunk headers. Never includes full
 * `+`/`-` hunk bodies.
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { IssueMeta } from '@devdigest/shared';
import { MAX_BODY_CHARS, MAX_HUNK_HEADERS, MAX_ISSUE_BODY_CHARS, MAX_PLAN_SPEC_CHARS } from './constants.js';

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@.*$/;

export type IntentSourceFlags = {
  title: boolean;
  body: boolean;
  linked_issue: boolean;
  plan_spec: boolean;
  files: boolean;
  hunk_headers: boolean;
};

export type IntentSourcesMeta = {
  context_quality: 'high' | 'medium' | 'low';
  missing: string[];
  sources: IntentSourceFlags;
  body_len: number;
  files_n: number;
  hunk_headers_n: number;
};

export type IntentSourcesBundle = {
  /** Classifier user payload (no diff bodies). */
  text: string;
  meta: IntentSourcesMeta;
};

export type PrFileForIntent = {
  path: string;
  additions: number | null;
  deletions: number | null;
  patch: string | null;
};

export type BuildIntentSourcesInput = {
  title: string;
  body: string | null | undefined;
  linkedIssue: IssueMeta | null | undefined;
  files: PrFileForIntent[];
  /** Absolute clone path; when absent, plan/spec links are marked missing. */
  clonePath: string | null | undefined;
};

/** Extract unified-diff hunk header lines only (no +/- bodies). */
export function extractHunkHeaders(patch: string | null | undefined): string[] {
  if (!patch) return [];
  const out: string[] = [];
  for (const line of patch.split('\n')) {
    if (HUNK_HEADER_RE.test(line)) out.push(line);
  }
  return out;
}

/** True if any classifier payload line looks like a diff body +/- line. */
export function hasDiffBodyLines(text: string): boolean {
  return text.split('\n').some((line) => {
    if (line.startsWith('+++ ') || line.startsWith('--- ')) return false;
    if (HUNK_HEADER_RE.test(line)) return false;
    return /^[+-]/.test(line) && !/^[+-]{3}/.test(line);
  });
}

function isPathSafe(relPath: string, clonePath: string): boolean {
  if (relPath.includes('\0') || relPath.startsWith('/') || /^[a-zA-Z]:/.test(relPath)) return false;
  const norm = relPath.replace(/\\/g, '/');
  if (norm.split('/').some((p) => p === '..')) return false;
  const abs = resolve(clonePath, norm);
  return abs.startsWith(clonePath);
}

/** Best-effort extract repo-relative plan/spec paths from PR body markdown. */
export function extractPlanSpecCandidates(body: string): string[] {
  const found = new Set<string>();
  // Markdown links: [label](path) — skip http(s)
  const mdLink = /\[([^\]]*)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdLink.exec(body))) {
    const href = (m[2] ?? '').trim();
    if (!href || /^https?:\/\//i.test(href) || href.startsWith('#')) continue;
    const path = href.replace(/^\.?\//, '').split(/[?#]/)[0]!;
    if (looksLikePlanSpec(path)) found.add(path);
  }
  // Bare paths mentioning plan/spec/design docs
  const bare = body.match(/(?:^|\s)((?:[\w.-]+\/)*[\w.-]+\.(?:md|txt|rst))(?=\s|$|[),])/gi) ?? [];
  for (const raw of bare) {
    const path = raw.trim().replace(/^\.?\//, '');
    if (looksLikePlanSpec(path)) found.add(path);
  }
  return [...found].slice(0, 5);
}

function looksLikePlanSpec(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    /(?:^|\/)(?:docs\/)?(?:plans?|specs?|design|adr|rfcs?)\//.test(lower) ||
    /(?:plan|spec|design|proposal|rfc)/.test(lower)
  );
}

async function tryReadPlanSpec(
  clonePath: string | null | undefined,
  body: string,
  missing: string[],
): Promise<string | null> {
  const candidates = extractPlanSpecCandidates(body);
  if (candidates.length === 0) return null;
  if (!clonePath) {
    missing.push('plan_spec');
    return null;
  }
  for (const rel of candidates) {
    if (!isPathSafe(rel, clonePath)) continue;
    try {
      const raw = await readFile(join(clonePath, rel), 'utf8');
      return `# ${rel}\n${raw.slice(0, MAX_PLAN_SPEC_CHARS)}`;
    } catch {
      /* try next */
    }
  }
  missing.push('plan_spec');
  return null;
}

function qualityFrom(flags: IntentSourceFlags, missing: string[]): 'high' | 'medium' | 'low' {
  const rich = (flags.body ? 1 : 0) + (flags.linked_issue ? 1 : 0) + (flags.plan_spec ? 1 : 0);
  if (rich >= 2) return 'high';
  if (rich === 1 || (flags.files && flags.hunk_headers && flags.body)) return 'medium';
  if (!flags.body || missing.includes('pr_body')) return 'low';
  return 'medium';
}

/**
 * Build the classifier payload + observability meta. Async only for optional
 * plan/spec file reads from the local clone.
 */
export async function buildIntentSources(input: BuildIntentSourcesInput): Promise<IntentSourcesBundle> {
  const missing: string[] = [];
  const title = input.title?.trim() || '(untitled)';
  const bodyRaw = input.body?.trim() ?? '';
  const body = bodyRaw.slice(0, MAX_BODY_CHARS);
  if (!bodyRaw) missing.push('pr_body');

  const sections: string[] = [];
  sections.push(`# Title\n${title}`);

  if (body) {
    sections.push(`# Description\n${body}`);
  } else {
    sections.push('# Description\n(empty)');
  }

  let linkedIssue = false;
  if (input.linkedIssue) {
    linkedIssue = true;
    const issueBody = (input.linkedIssue.body ?? '').slice(0, MAX_ISSUE_BODY_CHARS);
    sections.push(
      `# Linked issue #${input.linkedIssue.number}\n` +
        `title: ${input.linkedIssue.title}\n` +
        `state: ${input.linkedIssue.state}\n` +
        (issueBody ? `body:\n${issueBody}` : 'body: (empty)'),
    );
  } else {
    missing.push('linked_issue');
  }

  const planSpec = bodyRaw ? await tryReadPlanSpec(input.clonePath, bodyRaw, missing) : null;
  if (planSpec) {
    sections.push(`# Plan / spec\n${planSpec}`);
  }

  const files = input.files;
  const fileLines = files.map((f) => {
    const a = f.additions ?? 0;
    const d = f.deletions ?? 0;
    return `- ${f.path} (+${a}/-${d})`;
  });
  sections.push(`# Files changed (${files.length})\n${fileLines.length ? fileLines.join('\n') : '(none)'}`);

  const headers: string[] = [];
  for (const f of files) {
    for (const h of extractHunkHeaders(f.patch)) {
      if (headers.length >= MAX_HUNK_HEADERS) break;
      headers.push(`${f.path}: ${h}`);
    }
    if (headers.length >= MAX_HUNK_HEADERS) break;
  }
  sections.push(
    `# Hunk headers (${headers.length})\n${headers.length ? headers.join('\n') : '(none)'}`,
  );

  const sources: IntentSourceFlags = {
    title: true,
    body: bodyRaw.length > 0,
    linked_issue: linkedIssue,
    plan_spec: planSpec != null,
    files: files.length > 0,
    hunk_headers: headers.length > 0,
  };

  const text = sections.join('\n\n');

  return {
    text,
    meta: {
      context_quality: qualityFrom(sources, missing),
      missing,
      sources,
      body_len: bodyRaw.length,
      files_n: files.length,
      hunk_headers_n: headers.length,
    },
  };
}
