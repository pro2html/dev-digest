import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../lib/toast";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/skills",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("../../../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));

const SKILLS: Skill[] = [
  {
    id: "sk1",
    name: "test-coverage-nudge",
    description: "Coverage hints",
    type: "custom",
    source: "manual",
    body: "# Coverage",
    enabled: true,
    version: 1,
  },
  {
    id: "sk2",
    name: "pr-quality-rubric",
    description: "PR quality",
    type: "rubric",
    source: "manual",
    body: "# Rubric",
    enabled: true,
    version: 1,
  },
];

let skillsData: Skill[] = SKILLS;

vi.mock("../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: skillsData, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateSkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useImportSkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { SkillsListView } from "./SkillsListView";

afterEach(() => {
  cleanup();
  push.mockClear();
  skillsData = SKILLS;
});

function renderList() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <ToastProvider>
          <SkillsListView />
        </ToastProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("SkillsListView", () => {
  it("renders the grid of skills", () => {
    renderList();
    expect(screen.getByText("test-coverage-nudge")).toBeInTheDocument();
    expect(screen.getByText("pr-quality-rubric")).toBeInTheDocument();
  });

  it("filters skills by search", () => {
    renderList();
    fireEvent.change(screen.getByPlaceholderText("Search skills…"), {
      target: { value: "rubric" },
    });
    expect(screen.getByText("pr-quality-rubric")).toBeInTheDocument();
    expect(screen.queryByText("test-coverage-nudge")).not.toBeInTheDocument();
  });

  it("shows empty state when there are no skills", () => {
    skillsData = [];
    renderList();
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
    expect(screen.getByText("Import from file")).toBeInTheDocument();
  });

  it("navigates to the skill editor on card click", () => {
    renderList();
    fireEvent.click(screen.getByText("test-coverage-nudge"));
    expect(push).toHaveBeenCalledWith("/skills/sk1?tab=config");
  });
});
