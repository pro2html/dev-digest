import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/multiAgent.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/repos/r1/multi-agent",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ repoId: "r1" }),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));

const AGENTS: Agent[] = [
  {
    id: "a1",
    name: "Security",
    description: "Looks for leaks",
    provider: "openai",
    model: "gpt-4.1",
    system_prompt: "x",
    enabled: true,
    version: 1,
    strategy: "single-pass",
    ci_fail_on: "critical",
    repo_intel: true,
  },
  {
    id: "a2",
    name: "Perf",
    description: "Looks for cliffs",
    provider: "openai",
    model: "gpt-4.1",
    system_prompt: "x",
    enabled: false,
    version: 1,
    strategy: "single-pass",
    ci_fail_on: "critical",
    repo_intel: true,
  },
];

vi.mock("@/lib/hooks/agents", () => ({
  useAgents: () => ({ data: AGENTS }),
}));

vi.mock("@/lib/hooks/core", () => ({
  usePulls: () => ({
    data: [{ id: "pr-1", number: 12, title: "Fix auth", status: "open" }],
  }),
}));

vi.mock("@/lib/hooks/multi-agent", () => ({
  useReviewEstimates: () => ({
    data: [
      { agent_id: "a1", estimate_duration_ms: 12000, estimate_cost_usd: 0.2 },
      { agent_id: "a2", estimate_duration_ms: null, estimate_cost_usd: null },
    ],
  }),
  useStartMultiAgentRun: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { ConfigureRunView } from "./ConfigureRunView";

afterEach(cleanup);

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ multiAgent: messages }}>
      <ConfigureRunView repoId="r1" />
    </NextIntlClientProvider>,
  );
}

describe("ConfigureRunView (AC-01, AC-05, AC-06)", () => {
  it("shows empty agents panel and a disabled start when no pull is selected", () => {
    renderView();
    expect(screen.getByTestId("empty-agents")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run multi-agent review \(0\)/i })).toBeDisabled();
  });

  it("selects all listed agents, then clears with the same control", () => {
    renderView();
    fireEvent.click(screen.getByText("Select a pull request…"));
    fireEvent.click(screen.getByText("#12 · Fix auth"));
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getAllByRole("checkbox").every((el) => el.getAttribute("aria-checked") === "true")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getAllByRole("checkbox").every((el) => el.getAttribute("aria-checked") === "false")).toBe(true);
    expect(screen.getByRole("button", { name: /Run multi-agent review \(0\)/i })).toBeDisabled();
  });
});
