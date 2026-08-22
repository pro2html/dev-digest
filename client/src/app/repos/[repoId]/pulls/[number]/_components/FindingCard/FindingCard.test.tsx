import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import type { FindingRecord } from "@devdigest/shared";
import { ApiError } from "../../../../../../../lib/api";
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
    expected_output: { expectation: "must_find", findings: [{ file: "src/config.ts", start_line: 11 }] },
    expectation: "must_find" as const,
    finding_title: "Hardcoded Stripe secret key",
    finding_file: "src/config.ts",
    start_line: 11,
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
    fireEvent.click(screen.getByText("Accept"));
    expect(onAction).toHaveBeenCalledWith("accept");
    fireEvent.click(screen.getByText("Dismiss"));
    expect(onAction).toHaveBeenCalledWith("dismiss");
  });

  it("shows the undecided-finding error from the action row (AC-03)", async () => {
    preview.mutateAsync.mockRejectedValue(
      new ApiError("A decision on the finding is required first", 409, "finding_not_decided"),
    );
    preview.error = new ApiError("A decision on the finding is required first", 409, "finding_not_decided");
    renderWithIntl(<FindingCard f={FINDING} defaultExpanded onAction={() => {}} />);
    fireEvent.click(screen.getByText("Turn into eval case"));
    await waitFor(() => expect(preview.mutateAsync).toHaveBeenCalledWith("f1"));
    expect(await screen.findByText("Decide on the finding first.")).toBeInTheDocument();
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
