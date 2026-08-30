import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { EvalOwnerDashboard, EvalSetRun } from "@devdigest/shared";
import messages from "../../../../messages/en/eval.json";

const compareMutate = vi.fn();
let dashData: EvalOwnerDashboard | undefined;
let historyData: EvalSetRun[] = [];

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("../../../lib/hooks/evals", () => ({
  useEvalOwnerDashboard: () => ({ data: dashData }),
  useEvalHistory: () => ({ data: historyData }),
  useCompareEvalRuns: () => ({ mutate: compareMutate, isPending: false, data: undefined, reset: vi.fn() }),
  useStartEvalSetRun: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { OwnerEvalView } from "./OwnerEvalView";

afterEach(() => {
  cleanup();
  compareMutate.mockReset();
  dashData = undefined;
  historyData = [];
});

function setRun(over: Partial<EvalSetRun> & Pick<EvalSetRun, "id" | "status">): EvalSetRun {
  return {
    owner_kind: "agent",
    owner_id: "ag1",
    owner_version: 1,
    system_prompt: "p",
    baseline_label: null,
    started_at: "2026-08-01T00:00:00.000Z",
    finished_at: "2026-08-01T00:00:01.000Z",
    cases_total: 4,
    cases_finished: 4,
    passed: 3,
    recall: 0.75,
    precision: 0.8,
    citation_accuracy: 1,
    recall_not_applicable: false,
    precision_not_applicable: false,
    citation_accuracy_not_applicable: false,
    cost_usd: 0.01,
    duration_ms: 1000,
    per_case: [],
    ...over,
  };
}

function renderOwner() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
      <OwnerEvalView ownerKind="agent" ownerId="ag1" title="Security Reviewer" />
    </NextIntlClientProvider>,
  );
}

describe("OwnerEvalView", () => {
  it("shows metric cards, trend, and the regression alert from the last two complete runs (AC-42, AC-43)", () => {
    dashData = {
      owner_kind: "agent",
      owner_id: "ag1",
      cases_total: 4,
      current: {
        recall: 0.6,
        precision: 0.8,
        citation_accuracy: 1,
        traces_passed: 2,
        traces_total: 4,
        cost_usd: 0.02,
      },
      delta: { recall: -0.2, precision: 0, citation_accuracy: 0 },
      current_not_applicable: null,
      trend: [
        {
          ran_at: "2026-08-01T00:00:00.000Z",
          recall: 0.8,
          precision: 0.8,
          citation_accuracy: 1,
          pass_rate: 0.75,
          cost_usd: 0.01,
        },
        {
          ran_at: "2026-08-02T00:00:00.000Z",
          recall: 0.6,
          precision: 0.8,
          citation_accuracy: 1,
          pass_rate: 0.5,
          cost_usd: 0.02,
        },
      ],
      recent_runs: [],
      alert: "recall dropped 20 points at v2",
    };
    historyData = [setRun({ id: "r2", status: "complete", owner_version: 2 })];
    renderOwner();
    expect(screen.getByText(/recall dropped 20 points at v2/i)).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText(/metric trend/i)).toBeInTheDocument();
  });

  it("shows an empty history state with no placeholder metric values (AC-46)", () => {
    dashData = {
      owner_kind: "agent",
      owner_id: "ag1",
      cases_total: 0,
      current: null,
      delta: null,
      current_not_applicable: null,
      trend: [],
      recent_runs: [],
      alert: null,
    };
    renderOwner();
    expect(screen.getAllByText(/No runs yet/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("RECALL")).not.toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("marks partial and cancelled history rows without treating them as the headline (AC-47)", () => {
    dashData = {
      owner_kind: "agent",
      owner_id: "ag1",
      cases_total: 4,
      current: {
        recall: 0.9,
        precision: 0.9,
        citation_accuracy: 1,
        traces_passed: 4,
        traces_total: 4,
        cost_usd: 0.01,
      },
      delta: null,
      current_not_applicable: null,
      trend: [],
      recent_runs: [],
      alert: null,
    };
    historyData = [
      setRun({ id: "partial", status: "partial", passed: 2, cases_finished: 3 }),
      setRun({ id: "cancelled", status: "cancelled", passed: 1, cases_finished: 1 }),
      setRun({ id: "complete", status: "complete", recall: 0.9 }),
    ];
    renderOwner();
    expect(screen.getAllByText("90%").length).toBeGreaterThan(0);
    expect(screen.getByText(/partial/i)).toBeInTheDocument();
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
  });

  it("enables Compare only when exactly two runs of this owner are selected (AC-39)", () => {
    historyData = [
      setRun({ id: "a", status: "complete" }),
      setRun({ id: "b", status: "complete" }),
    ];
    dashData = {
      owner_kind: "agent",
      owner_id: "ag1",
      cases_total: 2,
      current: {
        recall: 0.8,
        precision: 0.8,
        citation_accuracy: 1,
        traces_passed: 2,
        traces_total: 2,
        cost_usd: 0.01,
      },
      delta: null,
      current_not_applicable: null,
      trend: [],
      recent_runs: [],
      alert: null,
    };
    renderOwner();
    const compare = screen.getByRole("button", { name: /^Compare$/i });
    expect(compare).toBeDisabled();
    expect(screen.getByText(/Select exactly two runs of this owner/i)).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[0]!);
    expect(compare).toBeDisabled();
    fireEvent.click(boxes[1]!);
    expect(compare).toBeEnabled();
    fireEvent.click(compare);
    expect(compareMutate).toHaveBeenCalledWith({
      ownerKind: "agent",
      ownerId: "ag1",
      a: "a",
      b: "b",
    });
  });

  it("keeps Compare unavailable with an explanation when runs are not comparable (AC-55)", () => {
    historyData = [setRun({ id: "only", status: "complete" })];
    dashData = {
      owner_kind: "agent",
      owner_id: "ag1",
      cases_total: 1,
      current: null,
      delta: null,
      current_not_applicable: null,
      trend: [],
      recent_runs: [],
      alert: null,
    };
    renderOwner();
    expect(screen.getByRole("button", { name: /^Compare$/i })).toBeDisabled();
    expect(screen.getByText(/Select exactly two runs of this owner/i)).toBeInTheDocument();
  });
});
