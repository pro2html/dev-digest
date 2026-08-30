import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import type { FindingRecord } from "@devdigest/shared";
import prMessages from "../../../../../../../../messages/en/prReview.json";
import evalMessages from "../../../../../../../../messages/en/eval.json";

const preview = {
  mutateAsync: vi.fn(),
  isPending: false,
  error: undefined as unknown,
};

vi.mock("../../../../../../../lib/hooks/evals", () => ({
  useEvalCaseDraftFromFinding: () => preview,
  useCreateEvalCase: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateEvalCaseFromFinding: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateEvalCase: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRunEvalCase: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { FindingCard } from "./FindingCard";

afterEach(() => {
  cleanup();
  preview.mutateAsync.mockReset();
  preview.isPending = false;
  preview.error = undefined;
});

const FINDING: FindingRecord = {
  id: "f1",
  severity: "CRITICAL",
  category: "security",
  title: "Hardcoded Stripe secret key",
  file: "src/config.ts",
  start_line: 11,
  end_line: 11,
  rationale: "A **live** Stripe key is committed in source.",
  suggestion: "Move the key to an environment variable.",
  confidence: 0.95,
  kind: "finding",
  trifecta_components: null,
  evidence: null,
  review_id: "r1",
  accepted_at: null,
  dismissed_at: null,
};

const DRAFT = {
  existing: null,
  draft: {
    owner_kind: "agent" as const,
    owner_id: "ag1",
    name: "must-find-hardcoded-stripe-secret-key",
    input_diff: "diff --git a/src/config.ts b/src/config.ts\n",
    input_files: [{ path: "src/config.ts" }],
    input_meta: { title: "PR", body: "" },
    expected_output: {
      expectation: "must_find",
      findings: [{ file: "src/config.ts", start_line: 11, end_line: 11 }],
    },
    expectation: "must_find" as const,
    finding_title: "Hardcoded Stripe secret key",
    finding_file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    source: "accepted" as const,
    source_finding_id: "f1",
  },
};

function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: prMessages, eval: evalMessages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingCard (smoke, both themes)", () => {
  (["dark", "light"] as const).forEach((theme) => {
    it(`renders severity + file:line + rationale in ${theme}`, () => {
      renderWithIntl(
        <div data-theme={theme}>
          <FindingCard f={FINDING} defaultExpanded onAction={() => {}} />
        </div>,
      );
      expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
      expect(screen.getByText("src/config.ts:11")).toBeInTheDocument();
      expect(screen.getByText("security")).toBeInTheDocument();
    });
  });

  it("fires accept/dismiss actions", () => {
    const onAction = vi.fn();
    renderWithIntl(<FindingCard f={FINDING} defaultExpanded onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: /^Accept$/i }));
    expect(onAction).toHaveBeenCalledWith("accept");
    fireEvent.click(screen.getByRole("button", { name: /^Dismiss$/i }));
    expect(onAction).toHaveBeenCalledWith("dismiss");
  });

  it("paints Accept green and disables Dismiss after accept", () => {
    const onAction = vi.fn();
    renderWithIntl(
      <FindingCard
        f={{ ...FINDING, accepted_at: "2026-08-01T00:00:00.000Z" }}
        defaultExpanded
        onAction={onAction}
      />,
    );
    const accept = screen.getByRole("button", { name: /^Accept$/i });
    const dismiss = screen.getByRole("button", { name: /^Dismiss$/i });
    expect(accept).toHaveStyle({ color: "var(--ok)", borderColor: "var(--ok)" });
    expect(screen.getByText("accepted")).toHaveStyle({ color: "var(--ok)" });
    expect(dismiss).toBeDisabled();
    expect(dismiss).toHaveStyle({ cursor: "not-allowed" });
    fireEvent.click(dismiss);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("paints Dismiss red and disables Accept after dismiss", () => {
    const onAction = vi.fn();
    renderWithIntl(
      <FindingCard
        f={{ ...FINDING, dismissed_at: "2026-08-01T00:00:00.000Z" }}
        defaultExpanded
        onAction={onAction}
      />,
    );
    const accept = screen.getByRole("button", { name: /^Accept$/i });
    const dismiss = screen.getByRole("button", { name: /^Dismiss$/i });
    expect(dismiss).toHaveStyle({ color: "var(--crit)", borderColor: "var(--crit)" });
    expect(screen.getByText("dismissed")).toHaveStyle({ color: "var(--crit)" });
    expect(accept).toBeDisabled();
    expect(accept).toHaveStyle({ cursor: "not-allowed" });
    fireEvent.click(accept);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("undoes an accept so Accept, Dismiss and Turn into eval case reset", () => {
    const onAction = vi.fn();
    renderWithIntl(
      <FindingCard
        f={{ ...FINDING, accepted_at: "2026-08-01T00:00:00.000Z" }}
        defaultExpanded
        onAction={onAction}
      />,
    );
    const undo = screen.getByRole("button", { name: /Undo decision/i });
    expect(undo).toBeEnabled();
    fireEvent.click(undo);
    expect(onAction).toHaveBeenCalledWith("undecide");
  });

  it("keeps undo disabled until a decision is made", () => {
    const onAction = vi.fn();
    renderWithIntl(<FindingCard f={FINDING} defaultExpanded onAction={onAction} />);
    const undo = screen.getByRole("button", { name: /Undo decision/i });
    expect(undo).toBeDisabled();
    expect(undo).toHaveStyle({ cursor: "not-allowed" });
    fireEvent.click(undo);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("disables Turn into eval case until the finding is accepted or dismissed (AC-03)", () => {
    renderWithIntl(<FindingCard f={FINDING} defaultExpanded onAction={() => {}} />);
    const btn = screen.getByRole("button", { name: /Turn into eval case/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveStyle({ cursor: "not-allowed" });
    fireEvent.click(btn);
    expect(preview.mutateAsync).not.toHaveBeenCalled();
  });

  it("opens the eval case editor seeded from an accepted finding (AC-04)", async () => {
    preview.mutateAsync.mockResolvedValue(DRAFT);
    renderWithIntl(<FindingCard f={{ ...FINDING, accepted_at: "2026-08-01T00:00:00.000Z" }} defaultExpanded />);
    fireEvent.click(screen.getByText("Turn into eval case"));
    expect(await screen.findByText("Eval case · must-find-hardcoded-stripe-secret-key")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(dialog.closest("[data-finding-id]")).toBeNull();
    expect(dialog.parentElement?.parentElement).toBe(document.body);
  });

  it("opens the existing case when one already exists (AC-05)", async () => {
    preview.mutateAsync.mockResolvedValue({
      ...DRAFT,
      existing: {
        ...DRAFT.draft,
        id: "case-3",
        notes: null,
        expected_count: 1,
        input_revision: 1,
        last_result: "never_run",
        last_actual_count: null,
        last_recall: null,
        name: "existing-stripe-case",
      },
    });
    renderWithIntl(<FindingCard f={{ ...FINDING, accepted_at: "2026-08-01T00:00:00.000Z" }} defaultExpanded />);
    fireEvent.click(screen.getByText("Turn into eval case"));
    expect(await screen.findByText("Eval case · existing-stripe-case")).toBeInTheDocument();
  });
});
