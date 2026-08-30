import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { EvalRunComparison, EvalSetRun } from "@devdigest/shared";
import messages from "../../../messages/en/eval.json";
import { CompareModal } from "./CompareModal";

afterEach(cleanup);

function setRun(over: Partial<EvalSetRun> & Pick<EvalSetRun, "id">): EvalSetRun {
  return {
    owner_kind: "agent",
    owner_id: "ag1",
    owner_version: 1,
    system_prompt: "prompt-a",
    baseline_label: null,
    status: "complete",
    started_at: "2026-08-01T00:00:00.000Z",
    finished_at: "2026-08-01T00:00:01.000Z",
    cases_total: 2,
    cases_finished: 2,
    passed: 2,
    recall: 0.8,
    precision: 0.7,
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

describe("CompareModal", () => {
  it("warns when the comparison crosses a case input revision (AC-13)", () => {
    const comparison: EvalRunComparison = {
      a: setRun({ id: "a", owner_version: 1, system_prompt: "old" }),
      b: setRun({ id: "b", owner_version: 2, system_prompt: "new" }),
      delta: { recall: 0.1, precision: -0.05, citation_accuracy: 0, cost_usd: 0.002 },
      prompts: { a: "old", b: "new" },
      crosses_revision: true,
    };
    render(
      <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
        <CompareModal comparison={comparison} onClose={() => {}} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/crosses a case input revision/i)).toBeInTheDocument();
    expect(screen.getByText(/old/)).toBeInTheDocument();
    expect(screen.getByText(/new/)).toBeInTheDocument();
  });
});
