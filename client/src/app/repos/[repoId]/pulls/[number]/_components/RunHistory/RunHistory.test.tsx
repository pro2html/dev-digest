/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { MultiAgentRun, RunSummary } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import { RunHistory } from "./RunHistory";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    findings_count: 0,
    findings_critical: null,
    findings_warning: null,
    findings_suggestion: null,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function renderRuns(runs: RunSummary[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <RunHistory runs={runs} onOpenTrace={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("RunHistory — inline findings", () => {
  it("shows per-severity counters inline, and their hover-card from the matching review", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <RunHistory
          runs={[
            run({
              findings_count: 1,
              findings_critical: 1,
              findings_warning: 0,
              findings_suggestion: 0,
              blockers: 1,
              score: 61,
            }),
          ]}
          reviews={[
            {
              id: "rev-1",
              pr_id: "pr-1",
              agent_id: "a1",
              run_id: "run-1",
              agent_name: "Security Reviewer",
              kind: "review",
              verdict: "request_changes",
              summary: "s",
              score: 61,
              model: "gpt-4.1",
              grounding: null,
              created_at: "2026-06-11T18:44:34.000Z",
              findings: [
                {
                  id: "f1",
                  review_id: "rev-1",
                  severity: "CRITICAL",
                  category: "security",
                  title: "Hardcoded Stripe secret key",
                  file: "src/config.ts",
                  start_line: 12,
                  end_line: 12,
                  rationale: "r",
                  suggestion: null,
                  confidence: 0.98,
                  kind: "secret_leak",
                  trifecta_components: null,
                  evidence: null,
                  accepted_at: null,
                  dismissed_at: null,
                },
              ],
            },
          ]}
          onOpenTrace={() => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("1", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/1 blockers/)).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId("findings-indicator"));
    expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
  });
});

const PARENT: MultiAgentRun = {
  id: "parent-1",
  pr_id: "pr-1",
  ran_at: "2026-08-30T10:00:00.000Z",
  agent_count: 2,
  total_duration_ms: 1800,
  total_cost_usd: 0.3,
  columns: [
    {
      run_id: "run-1",
      agent_id: "sec",
      agent_name: "Security Reviewer",
      provider: "openai",
      model: "gpt-4.1",
      status: "done",
      verdict: null,
      score: 80,
      summary: null,
      duration_ms: 1000,
      cost_usd: 0.2,
      findings: [],
    },
    {
      run_id: "run-nested",
      agent_id: "perf",
      agent_name: "Perf",
      provider: "openai",
      model: "gpt-4.1",
      status: "done",
      verdict: null,
      score: 70,
      summary: null,
      duration_ms: 800,
      cost_usd: 0.1,
      findings: [],
    },
  ],
  conflicts: [],
};

describe("RunHistory — multi-agent parent card", () => {
  it("nests child runs under an expandable parent and links to the results page", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <RunHistory
          runs={[run({ run_id: "run-1" }), run({ run_id: "run-standalone", agent_name: "Solo" })]}
          parents={[PARENT]}
          parentHref={(id) => `/repos/r1/multi-agent/pr-1?run=${id}`}
          onOpenTrace={() => {}}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByTestId("ma-parent-parent-1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open run" })).toHaveAttribute(
      "href",
      "/repos/r1/multi-agent/pr-1?run=parent-1",
    );
    expect(screen.getByText("Perf")).toBeInTheDocument();
    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.getAllByText("Security Reviewer")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /Multi-agent review/i }));
    expect(screen.queryByTestId("ma-parent-body-parent-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Multi-agent review/i }));
    expect(screen.getByTestId("ma-parent-body-parent-1")).toBeInTheDocument();
  });
});
