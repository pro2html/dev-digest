/**
 * Scope filter — drop non-critical findings that clearly match derived
 * out-of-scope topics. Never drops CRITICAL / security / secret-related kinds.
 * Does NOT invent fake file:line findings for the OOS signal.
 */
import type { Finding, Intent } from '@devdigest/shared';

const PROTECTED_KINDS = new Set(['secret_leak', 'lethal_trifecta']);

export type ScopeFilterResult = {
  kept: Finding[];
  dropped: Finding[];
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** True when finding text clearly references an out-of-scope topic. */
function matchesOutOfScope(finding: Finding, topic: string): boolean {
  const t = normalize(topic);
  if (t.length < 3) return false;
  const hay = normalize(`${finding.title}\n${finding.rationale}\n${finding.category}`);
  if (hay.includes(t)) return true;
  // Token overlap for multi-word topics (require ≥2 significant tokens).
  const tokens = t.split(/[^a-z0-9_/-]+/).filter((w) => w.length >= 4);
  if (tokens.length < 2) return false;
  const hits = tokens.filter((tok) => hay.includes(tok)).length;
  return hits >= Math.ceil(tokens.length * 0.6);
}

function isProtected(f: Finding): boolean {
  if (f.severity === 'CRITICAL') return true;
  if (f.category === 'security') return true;
  if (f.kind && PROTECTED_KINDS.has(f.kind)) return true;
  return false;
}

/**
 * Drop findings that are clearly about `intent.out_of_scope` topics when they
 * are not CRITICAL/security/secret-related. Empty out_of_scope → no-op.
 */
export function filterOutOfScopeFindings(
  findings: Finding[],
  intent: Intent | null | undefined,
): ScopeFilterResult {
  const topics = intent?.out_of_scope?.filter((t) => t.trim().length > 0) ?? [];
  if (topics.length === 0) return { kept: findings, dropped: [] };

  const kept: Finding[] = [];
  const dropped: Finding[] = [];
  for (const f of findings) {
    if (isProtected(f)) {
      kept.push(f);
      continue;
    }
    const oos = topics.some((topic) => matchesOutOfScope(f, topic));
    if (oos) dropped.push(f);
    else kept.push(f);
  }
  return { kept, dropped };
}

/** Summary suffix when non-critical OOS findings were suppressed (no fake citation). */
export function outOfScopeSummarySuffix(droppedCount: number): string {
  if (droppedCount <= 0) return '';
  return (
    `\n\n(${droppedCount} out-of-scope non-critical finding` +
    `${droppedCount === 1 ? ' was' : 's were'} suppressed based on derived intent.)`
  );
}

/** Format Intent for the prompt slot (caller wraps with wrapUntrusted). */
export function formatIntentForPrompt(intent: Intent): string {
  const lines = [
    intent.intent.trim(),
    '',
    'In scope:',
    ...(intent.in_scope.length ? intent.in_scope.map((s) => `- ${s}`) : ['- (none)']),
    '',
    'Out of scope:',
    ...(intent.out_of_scope.length ? intent.out_of_scope.map((s) => `- ${s}`) : ['- (none)']),
  ];
  return lines.join('\n');
}
