export type OrderedPath = { path: string; order: number };

export type InheritedSkillDocs = {
  paths: OrderedPath[];
};

/**
 * Effective attach set: agent paths in user order, then each inherited skill
 * in link order (skill attachments in stored order, else lexicographic).
 * Agent position wins on duplicates (AC-22).
 */
export function unionEffectivePaths(
  agentDocs: OrderedPath[],
  inheritedBySkillLinkOrder: InheritedSkillDocs[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const agentSorted = [...agentDocs].sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));
  for (const d of agentSorted) {
    if (seen.has(d.path)) continue;
    seen.add(d.path);
    out.push(d.path);
  }

  for (const skill of inheritedBySkillLinkOrder) {
    const hasStoredOrder = skill.paths.some((p) => Number.isFinite(p.order));
    const sorted = [...skill.paths].sort((a, b) => {
      if (hasStoredOrder) return a.order - b.order || a.path.localeCompare(b.path);
      return a.path.localeCompare(b.path);
    });
    for (const d of sorted) {
      if (seen.has(d.path)) continue;
      seen.add(d.path);
      out.push(d.path);
    }
  }
  return out;
}
