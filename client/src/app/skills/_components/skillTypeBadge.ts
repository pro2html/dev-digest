import type { SkillType } from "@devdigest/shared";

/** Type badge colors shared by SkillCard and the agent Skills tab (mockup). */
export const SKILL_TYPE_BADGE: Record<SkillType, { color: string; bg: string }> = {
  rubric: { color: "var(--accent)", bg: "var(--accent-bg)" },
  convention: { color: "var(--ok)", bg: "var(--ok-bg)" },
  security: { color: "var(--crit)", bg: "var(--crit-bg)" },
  custom: { color: "var(--text-secondary)", bg: "var(--info-bg)" },
};
