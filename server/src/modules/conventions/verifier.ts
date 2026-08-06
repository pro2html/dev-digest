/**
 * Conventions Extractor — verifier (PURE, no IO).
 *
 * Checks extracted candidates against the sample buffer the model actually saw.
 * Each candidate is either kept (possibly re-anchored) or dropped with a reason.
 */
import type { ConventionCategory } from '@devdigest/shared';
import type { SampleSet } from './sampler.js';
import { ruleHash } from './helpers.js';
import { MIN_SNIPPET_CHARS, LINE_TOLERANCE } from './constants.js';

const CONVENTION_CATEGORIES: ReadonlySet<string> = new Set([
  'naming', 'error_handling', 'async', 'structure', 'imports',
  'api_contract', 'testing', 'logging', 'types', 'other',
]);

const BANNED_PHRASES = [
  /^(write|use) (clean|good|proper)/i,
  /best practice/i,
  /should be readable/i,
];

export type DropReason =
  | 'path_not_sampled'
  | 'snippet_empty'
  | 'snippet_not_found'
  | 'rule_too_short'
  | 'rule_too_long'
  | 'rule_not_enforceable'
  | 'duplicate'
  | 'category_invalid';

export interface ExtractedCandidate {
  category: string;
  rule: string;
  applies_to: string | null;
  evidence: {
    path: string;
    line: number;
    snippet: string;
  };
  also_seen_in: string[];
  confidence: number;
}

export interface VerifiedCandidate {
  category: ConventionCategory;
  rule: string;
  ruleHash: string;
  appliesTo: string | null;
  evidencePath: string;
  evidenceLine: number | null;
  evidenceSnippet: string;
  confidence: number;
}

export interface VerifyInput {
  candidates: ExtractedCandidate[];
  samples: SampleSet;
  existingRuleHashes: Set<string>;
}

export interface VerifyResult {
  kept: VerifiedCandidate[];
  dropped: Record<string, number>;
  notes: Array<{ rule: string; reason: DropReason | 'reanchored' | 'kept' }>;
}

export function verifyCandidates(input: VerifyInput): VerifyResult {
  const { candidates, samples, existingRuleHashes } = input;
  const kept: VerifiedCandidate[] = [];
  const dropped: Record<string, number> = {};
  const notes: VerifyResult['notes'] = [];
  const seenHashes = new Set<string>(existingRuleHashes);
  const sampledPathSet = new Map<string, string>();

  for (const f of samples.files) {
    sampledPathSet.set(normalizePath(f.path), f.content);
  }

  for (const candidate of candidates) {
    const result = verifyOne(candidate, sampledPathSet, seenHashes);
    if (result.drop) {
      dropped[result.drop] = (dropped[result.drop] ?? 0) + 1;
      notes.push({ rule: candidate.rule, reason: result.drop });
    } else {
      kept.push(result.verified!);
      if (result.reanchored) {
        notes.push({ rule: candidate.rule, reason: 'reanchored' });
      } else {
        notes.push({ rule: candidate.rule, reason: 'kept' });
      }
    }
  }

  return { kept, dropped, notes };
}

interface VerifyOneResult {
  drop?: DropReason;
  verified?: VerifiedCandidate;
  reanchored?: boolean;
}

function verifyOne(
  candidate: ExtractedCandidate,
  sampledPaths: Map<string, string>,
  seenHashes: Set<string>,
): VerifyOneResult {
  const { evidence, rule: rawRule } = candidate;

  // 1. Path check
  const normPath = normalizePath(evidence.path);
  if (!normPath || isAbsoluteOrTraversal(normPath)) {
    return { drop: 'path_not_sampled' };
  }
  const fileContent = sampledPaths.get(normPath);
  if (fileContent === undefined) {
    return { drop: 'path_not_sampled' };
  }

  // 2. Snippet empty
  const snippet = evidence.snippet.trim();
  if (snippet.length < MIN_SNIPPET_CHARS) {
    return { drop: 'snippet_empty' };
  }

  // 3. Snippet found in file
  const normSnippet = normalizeSnippet(snippet);
  const normContent = normalizeSnippet(fileContent);
  if (!normContent.includes(normSnippet)) {
    return { drop: 'snippet_not_found' };
  }

  // 4. Re-anchor line if needed
  let evidenceLine: number | null = evidence.line;
  let reanchored = false;
  const foundLine = findSnippetLine(fileContent, snippet);
  if (foundLine !== null) {
    if (Math.abs(foundLine - evidence.line) > LINE_TOLERANCE) {
      evidenceLine = foundLine;
      reanchored = true;
    }
  }

  // 5. Rule length
  const rule = rawRule.trim().replace(/\.$/, '');
  if (rule.length < 10) return { drop: 'rule_too_short' };
  if (rule.length > 300) return { drop: 'rule_too_long' };

  // 6. Enforceability
  if (isUnenforceableRule(rule)) return { drop: 'rule_not_enforceable' };

  // 7. Category
  if (!CONVENTION_CATEGORIES.has(candidate.category)) {
    return { drop: 'category_invalid' };
  }

  // 8. Duplicate
  const hash = ruleHash(rule);
  if (seenHashes.has(hash)) {
    return { drop: 'duplicate' };
  }
  seenHashes.add(hash);

  // Normalize output
  const confidence = Math.max(0, Math.min(1, candidate.confidence));
  const appliesTo = candidate.applies_to?.trim() || null;

  return {
    verified: {
      category: candidate.category as ConventionCategory,
      rule,
      ruleHash: hash,
      appliesTo,
      evidencePath: evidence.path,
      evidenceLine,
      evidenceSnippet: snippet,
      confidence,
    },
    reanchored,
  };
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isAbsoluteOrTraversal(p: string): boolean {
  return p.startsWith('/') || p.includes('..');
}

/** Collapse whitespace runs and strip trailing punctuation for fuzzy match. */
function normalizeSnippet(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/[,;]\s*$/gm, '')
    .trim();
}

/** Find the 1-based line number where snippet starts in the raw content. */
function findSnippetLine(content: string, snippet: string): number | null {
  const lines = content.split('\n');
  const snippetFirstLine = snippet.split('\n')[0]!.trim();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim().includes(snippetFirstLine)) {
      return i + 1;
    }
  }
  return null;
}

function isUnenforceableRule(rule: string): boolean {
  if (BANNED_PHRASES.some((rx) => rx.test(rule))) return true;
  if (rule.startsWith('#') || rule.startsWith('##')) return true;
  if (/https?:\/\//.test(rule)) return true;
  return false;
}
