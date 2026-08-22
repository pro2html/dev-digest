import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { EvalWorkspaceDashboard } from "@devdigest/shared";
import messages from "../../../../messages/en/eval.json";

const runAllMutate = vi.fn();
let dashData: EvalWorkspaceDashboard = { agents: [], recent_runs: [] };

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("../../../lib/hooks/evals", () => ({
  useWorkspaceEvalDashboard: () => ({ data: dashData, isLoading: false }),
  useRunAllAgentsEvals: () => ({ mutateAsync: runAllMutate, isPending: false }),
}));

import { EvalDashboardView } from "./EvalDashboardView";

afterEach(() => {
  cleanup();
  runAllMutate.mockReset();
  dashData = { agents: [], recent_runs: [] };
});

function renderDash() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
      <EvalDashboardView />
    </NextIntlClientProvider>,
  );
}

describe("EvalDashboardView", () => {
  it("lists reviewer agents with latest complete metrics and a nav-linked card title in the primary foreground token (AC-41, AC-45)", () => {
    dashData = {
      agents: [
        {
          id: "ag1",
          name: "Security Reviewer",
          model: "gpt-4.1",
          latest_complete: {
            ran_at: "2026-08-01T00:00:00.000Z",
            owner_version: 2,
            recall: 0.8,
            precision: 0.75,
            citation_accuracy: 1,
            passed: 6,
            cases_total: 8,
          },
        },
      ],
      recent_runs: [],
    };
    renderDash();
    const title = screen.getByText("Security Reviewer");
    expect(title).toBeInTheDocument();
    expect(title).toHaveStyle({ color: "var(--text-primary)" });
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(title.closest("a")).toHaveAttribute("href", "/eval/ag1");
  });

  it("runs all agents and reports started versus skipped (AC-44)", async () => {
    runAllMutate.mockResolvedValue({
      started: [{ id: "r1" }],
      skipped: [{ id: "ag2", name: "Empty", reason: "no_cases" }],
    });
    renderDash();
    fireEvent.click(screen.getByRole("button", { name: /Run all agents/i }));
    expect(await screen.findByText(/Started 1 run\(s\); skipped 1 agent\(s\)/)).toBeInTheDocument();
  });
});
