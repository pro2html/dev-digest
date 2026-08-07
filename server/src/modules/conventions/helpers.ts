/**
 * Conventions Extractor — pure helpers: hashing, slug generation, row ⇄ DTO.
 */
import { createHash } from 'node:crypto';
import type { ConventionCandidate as CandidateDTO } from '@devdigest/shared';

/**
 * Deterministic hash of a rule for dedup: md5(rule.trim().toLowerCase()).
 * Same hash is used by the verifier for duplicate checks AND gives free
 * suppression of already-rejected rules on re-scan.
 */
export function ruleHash(rule: string): string {
  return createHash('md5').update(rule.trim().toLowerCase()).digest('hex');
}

/**
 * Kebab-case slug from a rule text, truncated to 48 chars.
 * Used in composer.ts for section headings.
 */
export function slug(rule: string, existing: Set<string> = new Set()): string {
  let base = rule
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 48)
    .replace(/-+$/, '');

  if (!base) base = 'rule';

  let candidate = base;
  let suffix = 1;
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  existing.add(candidate);
  return candidate;
}

/** Infer fence language from a file extension. */
export function fenceLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'ts' || ext === 'tsx') return 'ts';
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') return 'js';
  return '';
}

/** Convert a DB row to the client-facing DTO shape. */
export function rowToDto(row: {
  id: string;
  repoId: string | null;
  category: string;
  rule: string;
  appliesTo: string | null;
  evidencePath: string | null;
  evidenceLine: number | null;
  evidenceSnippet: string | null;
  confidence: number | null;
  supportCount: number | null;
  violationCount: number | null;
  status: string;
  edited: boolean;
  skillId: string | null;
  createdAt: Date;
}): CandidateDTO {
  return {
    id: row.id,
    repo_id: row.repoId ?? '',
    category: row.category as CandidateDTO['category'],
    rule: row.rule,
    applies_to: row.appliesTo,
    evidence_path: row.evidencePath ?? '',
    evidence_line: row.evidenceLine,
    evidence_snippet: row.evidenceSnippet ?? '',
    confidence: row.confidence ?? 0,
    support_count: row.supportCount,
    violation_count: row.violationCount,
    status: row.status as CandidateDTO['status'],
    edited: row.edited,
    skill_id: row.skillId,
    created_at: row.createdAt.toISOString(),
  };
}
