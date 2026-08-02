import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, AgentSkillLinkView, Skill } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";

const toggleMutate = vi.fn();
const setSkillsMutate = vi.fn();
const unlinkMutate = vi.fn();
const linkMutate = vi.fn();

const LINKS: AgentSkillLinkView[] = [
  {
    agent_id: "ag1",
    skill_id: "sk1",
    order: 0,
    enabled: true,
    name: "test-coverage-nudge",
    type: "custom",
    skill_enabled: true,
  },
  {
    agent_id: "ag1",
    skill_id: "sk2",
    order: 1,
    enabled: false,
    name: "test-corner-cases",
    type: "rubric",
    skill_enabled: true,
  },
];

const EXTRA: Skill = {
  id: "sk3",
  name: "pr-quality-rubric",
  description: "",
  type: "rubric",
  source: "manual",
  body: "# rubric",
  enabled: true,
  version: 1,
};

vi.mock("../../../../../../../lib/hooks/agents", () => ({
  useAgentSkills: () => ({ data: LINKS, isLoading: false, isError: false, refetch: vi.fn() }),
  useToggleAgentSkill: () => ({ mutate: toggleMutate, isPending: false }),
  useSetAgentSkills: () => ({ mutate: setSkillsMutate, isPending: false }),
  useUnlinkAgentSkill: () => ({ mutate: unlinkMutate, isPending: false }),
  useLinkAgentSkill: () => ({ mutate: linkMutate, isPending: false }),
}));

vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: [...LINKS.map((l) => ({ ...EXTRA, id: l.skill_id, name: l.name })), EXTRA] }),
}));

import { SkillsTab } from "./SkillsTab";

afterEach(() => {
  cleanup();
  toggleMutate.mockClear();
  setSkillsMutate.mockClear();
  unlinkMutate.mockClear();
  linkMutate.mockClear();
});

const AGENT: Agent = {
  id: "ag1",
  name: "Test Quality Reviewer",
  description: "",
  provider: "openrouter",
  model: "deepseek/deepseek-v4-flash",
  system_prompt: "You review tests.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <SkillsTab agent={AGENT} />
    </NextIntlClientProvider>,
  );
}

describe("SkillsTab", () => {
  it("renders linked skills and toggles enabled", () => {
    renderTab();
    expect(screen.getByText("test-coverage-nudge")).toBeInTheDocument();
    expect(screen.getByText("test-corner-cases")).toBeInTheDocument();

    const toggles = screen.getAllByRole("switch");
    fireEvent.click(toggles[1]!);
    expect(toggleMutate).toHaveBeenCalledWith({
      agentId: "ag1",
      skillId: "sk2",
      enabled: true,
    });
  });

  it("reorders with the down button", () => {
    renderTab();
    fireEvent.click(screen.getByLabelText("Move test-coverage-nudge down"));
    expect(setSkillsMutate).toHaveBeenCalledWith({
      agentId: "ag1",
      skills: [
        { skill_id: "sk2", order: 0, enabled: false },
        { skill_id: "sk1", order: 1, enabled: true },
      ],
    });
  });
});
