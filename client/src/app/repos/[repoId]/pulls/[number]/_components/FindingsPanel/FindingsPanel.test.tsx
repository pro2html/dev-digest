import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import type { ReactElement } from "react";
import messages from "../../../../../../../../messages/en/prReview.json";
import evalMessages from "../../../../../../../../messages/en/eval.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../../../../../../lib/hooks/evals", () => ({
  useEvalCaseDraftFromFinding: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: undefined,
  }),
  useCreateEvalCaseFromFinding: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
    data: undefined,
    error: undefined,
  }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

function finding(partial: Partial<FindingRecord> & Pick<FindingRecord, "id" | "severity" | "title">): FindingRecord {
  return {
    category: "bug",
    file: "src/a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "Reason",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...partial,
  };
}

const FINDINGS: FindingRecord[] = [
  finding({ id: "f-crit", severity: "CRITICAL", title: "Hardcoded secret", file: "src/config.ts", start_line: 11 }),
  finding({ id: "f-warn", severity: "WARNING", title: "N+1 query", category: "perf", file: "src/api.ts", start_line: 45 }),
  finding({ id: "f-sugg", severity: "SUGGESTION", title: "Rename helper", category: "style", file: "src/util.ts", start_line: 3 }),
];

function renderWithIntl(ui: ReactElement): RenderResult {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages, eval: evalMessages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={[FINDINGS[0]!]} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
    expect(screen.queryByTestId("severity-tabs")).not.toBeInTheDocument();
  });

  it("renders severity tabs only for non-zero counts (Icon Number Label)", () => {
    renderWithIntl(
      <FindingsPanel
        findings={[FINDINGS[0]!, FINDINGS[1]!, finding({ id: "f-d", severity: "WARNING", title: "Dismissed", dismissed_at: "2026-01-01" })]}
        prId="pr1"
      />,
    );
    const tabs = screen.getByTestId("severity-tabs");
    expect(tabs).toHaveTextContent("Critical");
    expect(tabs).toHaveTextContent("Warning");
    expect(tabs).not.toHaveTextContent("Suggestion");
    expect(screen.getByRole("tab", { name: "Show critical findings (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Show warning findings (1)" })).toBeInTheDocument();
  });

  it("activates a tab to filter by severity and toggles off to show all", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);

    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("N+1 query")).toBeInTheDocument();
    expect(screen.getByText("Rename helper")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Show warning findings (1)" }));
    expect(screen.queryByText("Hardcoded secret")).not.toBeInTheDocument();
    expect(screen.getByText("N+1 query")).toBeInTheDocument();
    expect(screen.queryByText("Rename helper")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Show warning findings (1)" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "Show suggestion findings (1)" }));
    expect(screen.queryByText("N+1 query")).not.toBeInTheDocument();
    expect(screen.getByText("Rename helper")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Show suggestion findings (1)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Show warning findings (1)" })).toHaveAttribute("aria-selected", "false");

    fireEvent.click(screen.getByRole("tab", { name: "Show suggestion findings (1)" }));
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("N+1 query")).toBeInTheDocument();
    expect(screen.getByText("Rename helper")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Show suggestion findings (1)" })).toHaveAttribute("aria-selected", "false");
  });
});
