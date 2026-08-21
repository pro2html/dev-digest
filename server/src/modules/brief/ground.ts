/**
 * Post-parse invariants before any Why+Risk Brief upsert (AC-04, AC-05, AC-06, AC-15).
 */
import type { WhyRiskBrief, WhyRiskFocusItem, WhyRiskItem } from '@devdigest/shared';
import { RiskSeverity } from '@devdigest/shared';
import { isTitleOnly, parseFileRef, toPosixRel } from './helpers.js';
import type { WhyRiskLlmOutput } from './llm-schema.js';

export type GroundOk = { ok: true; brief: WhyRiskBrief };
export type GroundFail = { ok: false; reason: string };
export type GroundResult = GroundOk | GroundFail;

export type GroundAllow = {
  changedPaths: string[];
  blastEndpoints: string[];
  pullTitle: string;
};

function pathSet(paths: string[]): Set<string> {
  return new Set(paths.map((p) => toPosixRel(p)).filter(Boolean));
}

function endpointSet(endpoints: string[]): Set<string> {
  return new Set(endpoints.map((e) => e.trim()).filter(Boolean));
}

/** Keep a file_ref if it is a changed-file path (optional :line/:start-end) or a blast endpoint. */
export function keepFileRef(raw: string, files: Set<string>, endpoints: Set<string>): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (endpoints.has(trimmed)) return trimmed;
  const parsed = parseFileRef(trimmed);
  if (files.has(parsed.path)) return trimmed;
  return null;
}

export function keepFocusPath(path: string, files: Set<string>): string | null {
  const posix = toPosixRel(path);
  if (!posix) return null;
  return files.has(posix) ? posix : null;
}

export function llmToBrief(raw: WhyRiskLlmOutput): WhyRiskBrief {
  const risks: WhyRiskItem[] = (raw.risks ?? []).map((r) => ({
    title: r.title,
    file_refs: r.file_refs ?? [],
    ...(r.explanation ? { explanation: r.explanation } : {}),
    ...(r.severity ? { severity: r.severity } : {}),
  }));
  const review_focus: WhyRiskFocusItem[] = (raw.review_focus ?? []).map((f) => ({
    path: f.path,
    reason: f.reason,
    ...(f.line_start != null ? { line_start: f.line_start } : {}),
    ...(f.line_end != null ? { line_end: f.line_end } : {}),
  }));
  return {
    what: raw.what,
    why: raw.why,
    risk_level: raw.risk_level,
    risks,
    review_focus,
  };
}

export function groundBrief(raw: WhyRiskLlmOutput, allow: GroundAllow): GroundResult {
  const parsed = RiskSeverity.safeParse(raw.risk_level);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid risk_level' };
  }
  if (isTitleOnly(raw.what ?? '', allow.pullTitle)) {
    return { ok: false, reason: 'what is empty or the pull title alone' };
  }
  if (isTitleOnly(raw.why ?? '', allow.pullTitle)) {
    return { ok: false, reason: 'why is empty or the pull title alone' };
  }

  const files = pathSet(allow.changedPaths);
  const endpoints = endpointSet(allow.blastEndpoints);
  const mapped = llmToBrief(raw);

  const risks = mapped.risks.map((r) => ({
    ...r,
    file_refs: r.file_refs.map((ref) => keepFileRef(ref, files, endpoints)).filter((x): x is string => x != null),
  }));

  const review_focus: WhyRiskFocusItem[] = [];
  for (const item of mapped.review_focus) {
    const path = keepFocusPath(item.path, files);
    if (!path) continue;
    review_focus.push({ ...item, path });
  }

  return {
    ok: true,
    brief: {
      what: mapped.what.trim(),
      why: mapped.why.trim(),
      risk_level: parsed.data,
      risks,
      review_focus,
    },
  };
}
