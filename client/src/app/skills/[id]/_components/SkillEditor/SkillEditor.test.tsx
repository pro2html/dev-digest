import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../../lib/toast";

vi.mock("../../../../../lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, data: undefined }),
  useSkillVersions: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useSkillStats: () => ({
    data: {
      used_by_agents: 0,
      findings_30d: 0,
      findings_by_category: { bug: 0, security: 0, perf: 0, style: 0, test: 0 },
      pull_frequency: null,
      accept_rate: null,
      agents: [],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import { SkillEditor } from "./SkillEditor";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "test-coverage-nudge",
  description: "Coverage hints",
  type: "custom",
  source: "manual",
  body: "# Coverage\nCheck branches.",
  enabled: true,
  version: 1,
};

function renderEditor(tab = "config") {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <SkillEditor skill={SKILL} tab={tab} onTab={() => {}} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("SkillEditor", () => {
  it("renders Config tab fields", () => {
    renderEditor("config");
    expect(screen.getByText("Config")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("shows Preview tab content when tab=preview", () => {
    renderEditor("preview");
    expect(screen.getByText("Rendered as the reviewing agent receives it")).toBeInTheDocument();
    expect(screen.getByText("Check branches.")).toBeInTheDocument();
  });

  it("marks the form unsaved when body changes", () => {
    renderEditor("config");
    const textarea = screen.getByDisplayValue(/# Coverage/);
    fireEvent.change(textarea, { target: { value: "# Coverage\nChanged body" } });
    expect(screen.getAllByText("unsaved").length).toBeGreaterThan(0);
  });
});
