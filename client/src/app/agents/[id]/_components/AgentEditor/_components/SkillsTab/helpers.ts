/** Move item at `from` to index `to`. Returns the same array if indices are invalid/equal. */
export function reorderLinks<T>(links: readonly T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= links.length ||
    to >= links.length
  ) {
    return [...links];
  }
  const next = [...links];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Payload for `POST /agents/:id/skills` after a reorder. */
export function toSetSkillsBody<T extends { skill_id: string; enabled: boolean }>(
  links: readonly T[],
) {
  return links.map((l, order) => ({
    skill_id: l.skill_id,
    order,
    enabled: l.enabled,
  }));
}

/** Case-insensitive filter over linked skill name (+ type). */
export function filterLinkedSkills<T extends { name: string; type: string }>(
  links: readonly T[],
  search: string,
): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...links];
  return links.filter((l) => `${l.name} ${l.type}`.toLowerCase().includes(q));
}

/** Map a visible-list reorder back onto the full ordered links array. */
export function reorderBySkillId<T extends { skill_id: string }>(
  links: readonly T[],
  fromSkillId: string,
  toSkillId: string,
): T[] {
  const from = links.findIndex((l) => l.skill_id === fromSkillId);
  const to = links.findIndex((l) => l.skill_id === toSkillId);
  return reorderLinks(links, from, to);
}
