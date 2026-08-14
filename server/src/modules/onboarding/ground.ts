/**
 * Post-parse invariants before any onboarding upsert (AC-03, AC-08–10, AC-13, AC-21, AC-23, AC-31).
 */
import type { OnboardingLayoutNode, OnboardingSection } from '@devdigest/shared';
import { SECTION_KINDS } from './constants.js';
import { dropMissingPaths, filterEnvVars, isVerbatimReadme } from './helpers.js';
import type { OnboardingLlmOutput, OnboardingLlmSection } from './llm-schema.js';

export type GroundOk = { ok: true; sections: OnboardingSection[] };
export type GroundFail = { ok: false; reason: string };
export type GroundResult = GroundOk | GroundFail;

function layoutFromLlm(node: OnboardingLlmSection['layout']): OnboardingLayoutNode | undefined {
  if (!node?.name) return undefined;
  const mapChildren = (
    children: { name: string; children?: { name: string }[] | null }[] | null | undefined,
  ): OnboardingLayoutNode[] | undefined => {
    if (!children?.length) return undefined;
    return children.map((c) => ({
      name: c.name,
      ...(c.children?.length
        ? { children: c.children.map((leaf) => ({ name: leaf.name })) }
        : {}),
    }));
  };
  return {
    name: node.name,
    ...(node.children?.length
      ? {
          children: node.children.map((mid) => ({
            name: mid.name,
            ...(mapChildren(mid.children) ? { children: mapChildren(mid.children) } : {}),
          })),
        }
      : {}),
  };
}

export function llmToSections(raw: OnboardingLlmOutput): OnboardingSection[] {
  return raw.sections.map((s) => {
    const layout = layoutFromLlm(s.layout);
    const flows = (s.flows ?? []).map((f) => ({
      title: f.title,
      steps: f.steps.map((st) => ({
        label: st.label,
        ...(st.path ? { path: st.path } : {}),
      })),
    }));
    const tasks = (s.tasks ?? []).map((t) => ({
      title: t.title,
      complexity: t.complexity,
      ...(t.path ? { path: t.path } : {}),
    }));
    const links = (s.links ?? []).map((l) => ({
      label: l.label,
      path: l.path,
      ...(l.note ? { note: l.note } : {}),
    }));
    return {
      kind: s.kind,
      title: s.title,
      body: s.body,
      diagram: s.diagram || undefined,
      links,
      ...(layout ? { layout } : {}),
      ...(flows.length ? { flows } : {}),
      ...(s.commands ? { commands: s.commands } : {}),
      ...(s.env_vars ? { env_vars: s.env_vars } : {}),
      ...(tasks.length ? { tasks } : {}),
    };
  });
}

function hasNestedLayout(layout: OnboardingLayoutNode | undefined): boolean {
  return Boolean(layout?.name);
}

function hasApplicationFlows(section: OnboardingSection): boolean {
  const flows = section.flows ?? [];
  if (flows.length === 0) return false;
  return flows.every((f) => f.steps.length >= 1);
}

export function validateStructure(sections: OnboardingSection[], readmeText: string | null): GroundFail | null {
  if (sections.length !== SECTION_KINDS.length) {
    return { ok: false, reason: `expected ${SECTION_KINDS.length} sections, got ${sections.length}` };
  }
  for (let i = 0; i < SECTION_KINDS.length; i++) {
    if (sections[i]?.kind !== SECTION_KINDS[i]) {
      return {
        ok: false,
        reason: `section ${i} kind is ${sections[i]?.kind ?? 'missing'}, expected ${SECTION_KINDS[i]}`,
      };
    }
  }
  const architecture = sections[0]!;
  if (!architecture.body.trim()) {
    return { ok: false, reason: 'architecture body is empty' };
  }
  if (!hasNestedLayout(architecture.layout)) {
    return { ok: false, reason: 'architecture is missing nested layout' };
  }
  const critical = sections[1]!;
  if (!hasApplicationFlows(critical)) {
    return { ok: false, reason: 'critical_paths must have flows with ordered steps (not a file list)' };
  }
  const local = sections[2]!;
  if (isVerbatimReadme(local.body, readmeText)) {
    return { ok: false, reason: 'local_setup body is a verbatim README copy' };
  }
  return null;
}

export async function groundTour(
  raw: OnboardingLlmOutput,
  opts: { clonePath: string; readmeText: string | null; envNames: Set<string> },
): Promise<GroundResult> {
  const mapped = llmToSections(raw);
  const structural = validateStructure(mapped, opts.readmeText);
  if (structural) return structural;

  const dropped = await dropMissingPaths(mapped, opts.clonePath);
  const local = dropped[2]!;
  const env_vars = filterEnvVars(local.env_vars, opts.envNames);
  dropped[2] = { ...local, env_vars };

  // Re-check kinds/order after drops — lists may be empty but kinds stay.
  const after = validateStructure(dropped, opts.readmeText);
  if (after) return after;
  return { ok: true, sections: dropped };
}
