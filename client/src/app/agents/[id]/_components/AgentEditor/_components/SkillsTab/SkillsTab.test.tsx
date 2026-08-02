import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, AgentSkillLinkView, Skill } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";
import {
  filterLinkedSkills,
  reorderBySkillId,
  reorderLinks,
  toSetSkillsBody,
} from "./helpers";

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

function mockDataTransfer(skillId: string) {
  const store: Record<string, string> = { "text/plain": skillId };
  return {
    effectAllowed: "all",
    dropEffect: "move",
    setData: (type: string, val: string) => {
      store[type] = val;
    },
    getData: (type: string) => store[type] ?? "",
  };
}

describe("reorderLinks", () => {
  it("moves an item to a new index", () => {
    expect(reorderLinks(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(reorderLinks(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("no-ops on invalid or equal indices", () => {
    expect(reorderLinks(["a", "b"], 0, 0)).toEqual(["a", "b"]);
    expect(reorderLinks(["a", "b"], -1, 0)).toEqual(["a", "b"]);
    expect(reorderLinks(["a", "b"], 0, 9)).toEqual(["a", "b"]);
  });

  it("builds set-skills body with contiguous order", () => {
    expect(toSetSkillsBody(reorderLinks(LINKS, 0, 1))).toEqual([
      { skill_id: "sk2", order: 0, enabled: false },
      { skill_id: "sk1", order: 1, enabled: true },
    ]);
  });

  it("reorders by skill id across a filtered view", () => {
    expect(reorderBySkillId(LINKS, "sk1", "sk2").map((l) => l.skill_id)).toEqual(["sk2", "sk1"]);
  });

  it("filters linked skills by name", () => {
    expect(filterLinkedSkills(LINKS, "corner").map((l) => l.skill_id)).toEqual(["sk2"]);
    expect(filterLinkedSkills(LINKS, "RUBRIC").map((l) => l.skill_id)).toEqual(["sk2"]);
  });
});

describe("SkillsTab", () => {
  it("renders linked skills and toggles enabled via checkbox", () => {
    renderTab();
    expect(screen.getByText("test-coverage-nudge")).toBeInTheDocument();
    expect(screen.getByText("test-corner-cases")).toBeInTheDocument();
    expect(screen.getByText("Order matters — earlier skills appear earlier in the assembled prompt. Drag to reorder.")).toBeInTheDocument();

    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[1]!);
    expect(toggleMutate).toHaveBeenCalledWith({
      agentId: "ag1",
      skillId: "sk2",
      enabled: true,
    });
  });

  it("filters the linked list", () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("Filter skills…"), {
      target: { value: "corner" },
    });
    expect(screen.queryByText("test-coverage-nudge")).not.toBeInTheDocument();
    expect(screen.getByText("test-corner-cases")).toBeInTheDocument();
  });

  it("reorders via drag-and-drop", () => {
    renderTab();
    const source = screen.getByLabelText("Drag to reorder test-coverage-nudge");
    const target = screen.getByLabelText("Drag to reorder test-corner-cases");
    const dt = mockDataTransfer("sk1");

    fireEvent.dragStart(source, { dataTransfer: dt });
    fireEvent.dragOver(target, { dataTransfer: dt });
    fireEvent.drop(target, { dataTransfer: dt });

    expect(setSkillsMutate).toHaveBeenCalledWith({
      agentId: "ag1",
      skills: [
        { skill_id: "sk2", order: 0, enabled: false },
        { skill_id: "sk1", order: 1, enabled: true },
      ],
    });
  });

  it("reorders via Alt+ArrowDown keyboard shortcut", () => {
    renderTab();
    const row = screen.getByLabelText("Drag to reorder test-coverage-nudge");
    fireEvent.keyDown(row, { key: "ArrowDown", altKey: true });
    expect(setSkillsMutate).toHaveBeenCalledWith({
      agentId: "ag1",
      skills: [
        { skill_id: "sk2", order: 0, enabled: false },
        { skill_id: "sk1", order: 1, enabled: true },
      ],
    });
  });
});
