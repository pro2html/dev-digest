import type { FindingCategory, Skill, SkillType, SkillSource, SkillVersion } from '@devdigest/shared';
import { FindingCategory as FindingCategoryEnum } from '@devdigest/shared';
import type { SkillRow, SkillVersionRow } from './repository.js';
import { IMPORTED_SKILL_FALLBACK_NAME } from './constants.js';

/**
 * Pure helpers for the skills module — DB row ⇄ DTO mapping, import name
 * extraction, and the prompt-body resolve rule used by the review executor.
 */

/** Map a persisted skill row to the public `Skill` DTO. */
export function toSkillDto(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
  };
}

/** Map a persisted `skill_versions` row to the public `SkillVersion` DTO. */
export function toSkillVersionDto(row: SkillVersionRow): SkillVersion {
  return {
    skill_id: row.skillId,
    version: row.version,
    body: row.body,
    created_at: row.createdAt.toISOString(),
  };
}

/**
 * Derive a skill name from imported markdown: first `# heading` text, else the
 * fallback. Leading/trailing whitespace on the heading is stripped.
 */
export function nameFromImportedMarkdown(body: string): string {
  const match = /^#\s+(.+)$/m.exec(body);
  const heading = match?.[1]?.trim();
  return heading && heading.length > 0 ? heading : IMPORTED_SKILL_FALLBACK_NAME;
}

/** A skill body candidate for prompt injection (pre- or post-DB filter). */
export interface SkillBodySource {
  name: string;
  body: string;
  /** `skills.enabled` — global toggle. */
  skillEnabled: boolean;
  /** `agent_skills.enabled` — per-agent toggle. */
  linkEnabled: boolean;
  order: number;
}

/**
 * Resolve skill bodies for the review prompt: keep only pairs where both the
 * skill and the agent-link are enabled, sort by `order`, prefix each body with
 * `### <name>` so the trace block is readable per skill.
 *
 * Empty result ⇒ caller must omit the `skills` slot (reviewer-core convention:
 * missing slot is not rendered; empty array must not be passed).
 */
export function resolveSkillBodiesForPrompt(sources: SkillBodySource[]): string[] {
  return sources
    .filter((s) => s.skillEnabled && s.linkEnabled)
    .sort((a, b) => a.order - b.order)
    .map((s) => `### ${s.name}\n${s.body}`);
}

/**
 * Join formatted skill bodies into the `prompt_assembly.skills` string, or
 * `null` when there are none (slot stays absent in the trace).
 */
export function skillBodiesToAssembly(bodies: string[]): string | null {
  return bodies.length > 0 ? bodies.join('\n\n') : null;
}

/** Empty per-category counters for SkillStats.findings_by_category. */
export function emptyFindingsByCategory(): Record<FindingCategory, number> {
  const out = {} as Record<FindingCategory, number>;
  for (const cat of FindingCategoryEnum.options) out[cat] = 0;
  return out;
}
