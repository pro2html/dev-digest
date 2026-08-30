import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MultiAgentRun } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/multiAgent.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/repos/r1/multi-agent/pr-1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ repoId: "r1", prId: "pr-1" }),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));

vi.mock("@/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer", () => ({
  default: ({ runId }: { runId: string }) => <div data-testid="run-trace-drawer">{runId}</div>,
}));

vi.mock("@/app/repos/[repoId]/pulls/[number]/_components/FindingCard", () => ({
  FindingCard: ({ f }: { f: { title: string } }) => <div>{f.title}</div>,
}));

const RUN: MultiAgentRun = {
  id: "parent-1",
  pr_id: "pr-1",
  ran_at: "2026-08-30T10:00:00.000Z",
  agent_count: 2,
  total_duration_ms: 1000,
  total_cost_usd: 0.2,
  columns: [
    {
      run_id: "run-sec",
      agent_id: "sec",
      agent_name: "Security",
      provider: "openai",
      model: "gpt-4.1",
      status: "done",
      verdict: null,
      score: 80,
      summary: "Looked at auth",
      duration_ms: 1000,
      cost_usd: 0.2,
      findings: [
        {
          id: "f1",
          severity: "CRITICAL",
          category: "security",
          title: "Secret leak",
          file: "a.ts",
          start_line: 10,
        },
      ],
    },
    {
      run_id: "run-perf",
      agent_id: "perf",
      agent_name: "Perf",
      provider: "openai",
      model: "gpt-4.1",
      status: "done",
      verdict: null,
      score: 70,
      summary: "Looked at loops",
      duration_ms: 800,
      cost_usd: 0.1,
      findings: [],
    },
  ],
  conflicts: [
    {
      file: "a.ts",
      line: 10,
      title: "Secret leak",
      takes: [
        { agent_id: "sec", persona: "Security", verdict: "CRITICAL", note: "Secret leak" },
        { agent_id: "perf", persona: "Perf", verdict: "ignored", note: "did not flag" },
      ],
    },
  ],
};

vi.mock("@/lib/hooks/multi-agent", () => ({
  useLatestMultiAgentRun: () => ({
    data: {
      pr_id: "pr-1",
      run: RUN,
      grouped_locations: [
        ...RUN.conflicts,
        {
          file: "b.ts",
          line: 2,
          title: "Agree",
          takes: [
            { agent_id: "sec", persona: "Security", verdict: "WARNING", note: "Agree" },
            { agent_id: "perf", persona: "Perf", verdict: "WARNING", note: "Agree" },
          ],
        },
      ],
    },
  }),
  useMultiAgentRunById: () => ({ data: undefined }),
}));

vi.mock("@/lib/hooks/reviews", () => ({
  useRunEvents: () => ({ events: [], running: false }),
  usePrReviews: () => ({ data: [] }),
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/lib/hooks/core", () => ({
  usePulls: () => ({ data: [{ id: "pr-1", number: 12, title: "Fix auth", status: "open" }] }),
}));

import { ResultsView } from "./ResultsView";

afterEach(cleanup);

function renderView() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={{ multiAgent: messages }}>
        <ResultsView repoId="r1" prId="pr-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("ResultsView (AC-19, AC-18, AC-23)", () => {
  it("defaults to Columns", () => {
    renderView();
    expect(screen.getByTestId("columns-view")).toBeInTheDocument();
    expect(screen.queryByTestId("tabs-view")).not.toBeInTheDocument();
  });

  it("toggles to Tabs", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Tabs" }));
    expect(screen.getByTestId("tabs-view")).toBeInTheDocument();
  });

  it("filters grouped locations when Show only conflicts is on", () => {
    renderView();
    const block = screen.getByTestId("disagree-block");
    expect(block).toHaveTextContent("a.ts:10");
    expect(block).toHaveTextContent("b.ts:2");
    fireEvent.click(screen.getByRole("switch"));
    expect(block).toHaveTextContent("a.ts:10");
    expect(block).not.toHaveTextContent("b.ts:2");
    expect(block).toHaveTextContent(/did not flag/i);
  });

  it("opens the run drawer from View trace", () => {
    renderView();
    fireEvent.click(screen.getAllByRole("button", { name: "View trace" })[0]!);
    expect(screen.getByTestId("run-trace-drawer")).toHaveTextContent("run-sec");
  });
});
