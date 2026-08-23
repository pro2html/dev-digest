import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { EvalCaseListItem, EvalRunResult } from "@devdigest/shared";
import { ApiError } from "../../lib/api";
import messages from "../../../messages/en/eval.json";

const createMutate = vi.fn();
const updateMutate = vi.fn();
const runMutate = vi.fn();
const fromFindingMutate = vi.fn();

vi.mock("../../lib/hooks/evals", () => ({
  useCreateEvalCase: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateEvalCase: () => ({ mutateAsync: updateMutate, isPending: false }),
  useRunEvalCase: () => ({ mutateAsync: runMutate, isPending: false }),
  useCreateEvalCaseFromFinding: () => ({ mutateAsync: fromFindingMutate, isPending: false }),
}));

import { CaseEditor } from "./CaseEditor";

afterEach(() => {
  cleanup();
  createMutate.mockReset();
  updateMutate.mockReset();
  runMutate.mockReset();
  fromFindingMutate.mockReset();
});

const EXISTING: EvalCaseListItem = {
  id: "case-1",
  owner_kind: "agent",
  owner_id: "ag1",
  name: "stripe-key-leak",
  input_diff: "diff --git a/src/a.ts b/src/a.ts\n",
  input_files: null,
  input_meta: { title: "Add Stripe", body: "" },
  expected_output: { expectation: "must_find", findings: [{ file: "src/a.ts", start_line: 11 }] },
  notes: null,
  expectation: "must_find",
  expected_count: 1,
  input_revision: 1,
  last_result: "never_run",
  last_actual_count: null,
  last_recall: null,
};

function renderEditor(existing: EvalCaseListItem | null = EXISTING) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
      <CaseEditor ownerKind="agent" ownerId="ag1" existing={existing} onClose={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("CaseEditor", () => {
  it("blocks save and run while expected-output JSON is invalid (AC-07)", async () => {
    renderEditor();
    const expected = screen.getByDisplayValue(/src\/a\.ts/);
    fireEvent.change(expected, { target: { value: "{not json" } });
    expect(screen.getByText("invalid JSON")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Save$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Run case/i })).toBeDisabled();
  });

  it("runs the case on save and shows result, duration and cost (AC-09)", async () => {
    const result: EvalRunResult = {
      run_id: "r1",
      case_id: "case-1",
      result: {
        recall: 1,
        precision: 1,
        citation_accuracy: 1,
        traces_passed: 1,
        traces_total: 1,
        duration_ms: 1200,
        cost_usd: 0.0042,
        per_trace: [],
      },
    };
    updateMutate.mockResolvedValue(EXISTING);
    runMutate.mockResolvedValue(result);
    renderEditor();
    const runOnSave = screen.getByRole("switch");
    expect(runOnSave).toHaveAttribute("aria-checked", "false");
    fireEvent.click(runOnSave);
    expect(runOnSave).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    await waitFor(() => expect(runMutate).toHaveBeenCalledWith("case-1"));
    expect(await screen.findByText(/Last run passed/i)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.0042/)).toBeInTheDocument();
    expect(screen.getByText(/1\.2s/)).toBeInTheDocument();
  });

  it("renders the two-column seeded editor from a finding (mockup)", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
        <CaseEditor
          ownerKind="agent"
          ownerId="ag1"
          seed={{
            owner_kind: "agent",
            owner_id: "ag1",
            name: "must-find-hardcoded-stripe-secret-key-in-com",
            input_diff:
              'diff --git a/src/config.ts b/src/config.ts\n--- a/src/config.ts\n+++ b/src/config.ts\n+  stripeKey: "sk_live_x",\n',
            input_files: [{ path: "src/config.ts" }],
            input_meta: { title: "Add Stripe", body: "" },
            expected_output: {
              expectation: "must_find",
              findings: [
                {
                  severity: "CRITICAL",
                  category: "security",
                  title: "Hardcoded Stripe secret key in commit",
                  file: "src/config.ts",
                  start_line: 12,
                  end_line: 20,
                },
              ],
            },
            expectation: "must_find",
            finding_title: "Hardcoded Stripe secret key in commit",
            finding_file: "src/config.ts",
            start_line: 12,
            end_line: 20,
            source: "accepted",
            source_finding_id: "f1",
          }}
          onClose={() => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/Eval case · must-find-hardcoded-stripe-secret-key-in-com/)).toBeInTheDocument();
    expect(screen.getByText(/Seeded from a accepted finding/i)).toBeInTheDocument();
    expect(screen.getByText(/POSITIVE CASE MUST find/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Finding skeleton/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run case/i })).toBeEnabled();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: /^Diff$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Files$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PR meta/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Hardcoded Stripe secret key in commit/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/"start_line": 12/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/"end_line": 20/)).toBeInTheDocument();
    expect(screen.getByText(/src\/config\.ts:12-20/)).toBeInTheDocument();
    expect(screen.getByText("Actual output")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Run the case to see what the reviewer returned/i)).toBeInTheDocument();
  });

  it("shows actual output after a failed run", async () => {
    const result: EvalRunResult = {
      run_id: "r1",
      case_id: "case-1",
      result: {
        recall: 0,
        precision: 0,
        citation_accuracy: 1,
        traces_passed: 0,
        traces_total: 1,
        duration_ms: 800,
        cost_usd: 0.001,
        per_trace: [
          {
            name: "stripe-key-leak",
            pass: false,
            expected: { findings: [{ file: "src/a.ts", start_line: 11 }] },
            actual: {
              findings: [{ file: "src/other.ts", start_line: 4, title: "Unrelated style nit" }],
            },
          },
        ],
      },
    };
    updateMutate.mockResolvedValue(EXISTING);
    runMutate.mockResolvedValue(result);
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /Run case/i }));
    expect(await screen.findByText(/Last run failed/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Unrelated style nit/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/src\/other\.ts/)).toBeInTheDocument();
  });

  it("re-seeds a negative case when the finding was dismissed after a must_find case already exists", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
        <CaseEditor
          ownerKind="agent"
          ownerId="ag1"
          existing={{ ...EXISTING, last_result: "failed", last_actual_count: 0 }}
          seed={{
            owner_kind: "agent",
            owner_id: "ag1",
            name: "must-not-flag-hardcoded-stripe-secret-key",
            input_diff: "diff --git a/src/a.ts b/src/a.ts\n",
            input_files: [{ path: "src/a.ts" }],
            input_meta: { title: "Add Stripe", body: "" },
            expected_output: {
              expectation: "must_not_flag",
              findings: [],
            },
            expectation: "must_not_flag",
            finding_title: "Hardcoded Stripe secret key",
            finding_file: "src/a.ts",
            start_line: 11,
            source: "dismissed",
            source_finding_id: "f1",
          }}
          onClose={() => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/NEGATIVE CASE MUST NOT FLAG/i)).toBeInTheDocument();
    expect(screen.queryByText(/POSITIVE CASE MUST find/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Seeded from a dismissed finding/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("[]")).toBeInTheDocument();
    expect(screen.queryByText(/Last run/i)).not.toBeInTheDocument();
  });

  it("passes a must_not_flag run when actual findings are empty", async () => {
    updateMutate.mockResolvedValue({ ...EXISTING, expectation: "must_not_flag", expected_count: 0 });
    runMutate.mockResolvedValue({
      run_id: "r-neg",
      case_id: "case-1",
      result: {
        recall: 1,
        precision: 1,
        citation_accuracy: 1,
        traces_passed: 1,
        traces_total: 1,
        duration_ms: 400,
        cost_usd: 0,
        per_trace: [
          {
            name: "must-not-flag",
            pass: true,
            expected: { expectation: "must_not_flag", findings: [] },
            actual: { findings: [] },
          },
        ],
      },
    } satisfies EvalRunResult);
    render(
      <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
        <CaseEditor
          ownerKind="agent"
          ownerId="ag1"
          existing={EXISTING}
          seed={{
            owner_kind: "agent",
            owner_id: "ag1",
            name: "must-not-flag-hardcoded-stripe-secret-key",
            input_diff: "diff --git a/src/a.ts b/src/a.ts\n",
            input_files: [{ path: "src/a.ts" }],
            input_meta: { title: "Add Stripe", body: "" },
            expected_output: { expectation: "must_not_flag", findings: [] },
            expectation: "must_not_flag",
            finding_title: "Hardcoded Stripe secret key",
            finding_file: "src/a.ts",
            start_line: 11,
            source: "dismissed",
            source_finding_id: "f1",
          }}
          onClose={() => {}}
        />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Run case/i }));
    expect(await screen.findByText(/Last run passed/i)).toBeInTheDocument();
    expect(screen.getByText(/expected 0 finding, got 0/i)).toBeInTheDocument();
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          expected_output: { expectation: "must_not_flag", findings: [] },
        }),
      }),
    );
  });

  it("runs only the eval from Run case and shows a loader without changing Save", async () => {
    updateMutate.mockResolvedValue(EXISTING);
    runMutate.mockImplementation(() => new Promise(() => {}));
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /Run case/i }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    await waitFor(() => expect(runMutate).toHaveBeenCalledWith("case-1"));
    expect(createMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Run case/i })).toBeDisabled();
    const save = screen.getByRole("button", { name: /^Save$/i });
    expect(save).toBeEnabled();
    expect(save).toHaveTextContent("Save");
  });

  it("PATCHes the existing case when create-from-finding returns eval_case_exists", async () => {
    fromFindingMutate.mockRejectedValue(
      new ApiError("An eval case already exists for this finding", 409, "eval_case_exists", {
        case_id: "case-1",
      }),
    );
    updateMutate.mockResolvedValue({ ...EXISTING, expectation: "must_not_flag", expected_count: 0 });
    runMutate.mockResolvedValue({
      run_id: "r-neg",
      case_id: "case-1",
      result: {
        recall: 1,
        precision: 1,
        citation_accuracy: 1,
        traces_passed: 1,
        traces_total: 1,
        duration_ms: 200,
        cost_usd: 0,
        per_trace: [
          {
            name: "must-not-flag",
            pass: true,
            expected: { expectation: "must_not_flag", findings: [] },
            actual: { findings: [] },
          },
        ],
      },
    } satisfies EvalRunResult);
    render(
      <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
        <CaseEditor
          ownerKind="agent"
          ownerId="ag1"
          seed={{
            owner_kind: "agent",
            owner_id: "ag1",
            name: "must-not-flag-hardcoded-stripe-secret-key",
            input_diff: "diff --git a/src/a.ts b/src/a.ts\n",
            input_files: [{ path: "src/a.ts" }],
            input_meta: { title: "Add Stripe", body: "" },
            expected_output: { expectation: "must_not_flag", findings: [] },
            expectation: "must_not_flag",
            finding_title: "Hardcoded Stripe secret key",
            finding_file: "src/a.ts",
            start_line: 11,
            source: "dismissed",
            source_finding_id: "f1",
          }}
          onClose={() => {}}
        />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Run case/i }));
    await waitFor(() => expect(fromFindingMutate).toHaveBeenCalled());
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "case-1",
        input: expect.objectContaining({
          expected_output: { expectation: "must_not_flag", findings: [] },
        }),
      }),
    );
    expect(await screen.findByText(/Last run passed/i)).toBeInTheDocument();
    expect(screen.getByText(/expected 0 finding, got 0/i)).toBeInTheDocument();
  });
});
