import type { SkillType } from "@devdigest/shared";

export const DEFAULT_TYPE: SkillType = "custom";
export const DEFAULT_BODY = "# New skill\n\nDescribe the rule the reviewing agent should follow…";
export const MODAL_WIDTH = 620;
export const SKILL_TYPE_OPTIONS: readonly SkillType[] = ["custom", "rubric", "convention", "security"];
