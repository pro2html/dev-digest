import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../lib/toast";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
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
    used_by_agents: 2,
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
    used_by_agents: 1,
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
  replace.mockClear();
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
  it("redirects into the always-split editor on the Preview tab", () => {
    renderList();
    expect(replace).toHaveBeenCalledWith("/skills/sk1?tab=preview");
  });

  it("shows empty state when there are no skills", () => {
    skillsData = [];
    renderList();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
    expect(screen.getByText("Import from file")).toBeInTheDocument();
  });
});
