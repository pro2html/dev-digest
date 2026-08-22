import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { EvalCaseListItem, EvalOwnerDashboard, EvalSetRun } from "@devdigest/shared";
import messages from "../../../messages/en/eval.json";

const startMutate = vi.fn();
const cancelMutate = vi.fn();
const runMutate = vi.fn();
const delMutate = vi.fn();

let casesData: EvalCaseListItem[] = [];
let dashData: EvalOwnerDashboard | undefined;
let historyData: EvalSetRun[] = [];

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("../../lib/hooks/evals", () => ({
  useEvalCases: () => ({ data: casesData, isLoading: false }),
  useEvalOwnerDashboard: () => ({ data: dashData }),
  useEvalHistory: () => ({ data: historyData }),
  useStartEvalSetRun: () => ({ mutateAsync: startMutate, isPending: false }),
  useCancelEvalSetRun: () => ({ mutate: cancelMutate, isPending: false }),
  useRunEvalCase: () => ({ mutate: runMutate, mutateAsync: runMutate, isPending: false }),
  useDeleteEvalCase: () => ({ mutate: delMutate, isPending: false }),
  useCreateEvalCase: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateEvalCaseFromFinding: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateEvalCase: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { EvalsTab } from "./EvalsTab";

afterEach(() => {
  cleanup();
  startMutate.mockReset();
  cancelMutate.mockReset();
  runMutate.mockReset();
  delMutate.mockReset();
  casesData = [];
  dashData = undefined;
  historyData = [];
});

function listItem(over: Partial<EvalCaseListItem> & Pick<EvalCaseListItem, "id" | "name">): EvalCaseListItem {
  return {
    owner_kind: "agent",
    owner_id: "ag1",
    input_diff: "",
    input_files: null,
    input_meta: null,
    expected_output: { expectation: "must_find", findings: [{ file: "src/a.ts", start_line: 1 }] },
    notes: null,
    expectation: "must_find",
    expected_count: 1,
    input_revision: 1,
    last_result: "never_run",
    last_actual_count: null,
    last_recall: null,
    ...over,
  };
}

function renderTab(ownerKind: "agent" | "skill" = "agent") {
  return render(
    <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
      <EvalsTab ownerKind={ownerKind} ownerId="ag1" />
    </NextIntlClientProvider>,
  );
}

describe("EvalsTab", () => {
  it("renders the mechanical-scoring note and all eight cases without truncation (AC-16, AC-35, AC-36)", () => {
    casesData = Array.from({ length: 8 }, (_, i) =>
      listItem({
        id: `c${i + 1}`,
        name: `case-${i + 1}`,
        expectation: i % 2 === 0 ? "must_find" : "must_not_flag",
        last_result: i === 0 ? "passed" : "never_run",
        last_actual_count: i === 0 ? 1 : null,
      }),
    );
    dashData = {
      owner_kind: "agent",
      owner_id: "ag1",
      cases_total: 8,
      current: {
        recall: 0.8,
        precision: 0.7,
        citation_accuracy: 1,
        traces_passed: 4,
        traces_total: 8,
        cost_usd: 0.01,
      },
      delta: null,
      current_not_applicable: null,
      trend: [],
      recent_runs: [],
      alert: null,
    };
    renderTab("agent");
    expect(
      screen.getByText(/Scoring is mechanical — a finding counts when file matches and line ranges overlap/i),
    ).toBeInTheDocument();
    for (let i = 1; i <= 8; i++) {
      expect(screen.getByText(`case-${i}`)).toBeInTheDocument();
    }
    expect(screen.getAllByText("MUST FIND").length).toBe(4);
    expect(screen.getAllByText("MUST NOT FLAG").length).toBe(4);
    expect(screen.getByText(/expected 1 finding, got 1/i)).toBeInTheDocument();
    expect(screen.getByText(/View full dashboard/i)).toBeInTheDocument();
  });

  it("shows the empty-set state and disables Run all evals (AC-21)", () => {
    renderTab();
    expect(screen.getByText(/No eval cases yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run all evals/i })).toBeDisabled();
  });

  it("shows progress on the run control and cancels the in-flight set (AC-17, AC-18)", () => {
    casesData = [listItem({ id: "c1", name: "one" })];
    historyData = [
      {
        id: "run-1",
        owner_kind: "agent",
        owner_id: "ag1",
        owner_version: 1,
        system_prompt: "p",
        baseline_label: null,
        status: "running",
        started_at: new Date().toISOString(),
        finished_at: null,
        cases_total: 9,
        cases_finished: 4,
        passed: null,
        recall: null,
        precision: null,
        citation_accuracy: null,
        recall_not_applicable: null,
        precision_not_applicable: null,
        citation_accuracy_not_applicable: null,
        cost_usd: null,
        duration_ms: null,
        per_case: [],
      },
    ];
    renderTab();
    const progress = screen.getByRole("button", { name: /Running 4\/9/i });
    expect(progress).toBeInTheDocument();
    expect(progress).toHaveTextContent(/Cancel/i);
    fireEvent.click(progress);
    expect(cancelMutate).toHaveBeenCalledWith("run-1");
  });

  it("does not render an agent selector for a skill-owned tab (AC-53)", () => {
    casesData = [listItem({ id: "c1", name: "skill-case", owner_kind: "skill", owner_id: "sk1" })];
    renderTab("skill");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/agent/i)).not.toBeInTheDocument();
    expect(screen.getByText("skill-case")).toBeInTheDocument();
  });
});
