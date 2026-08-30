import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/ci.json";
import type { CiRunRow } from "../../../../lib/hooks/ci";

let runs: { items: CiRunRow[] } | undefined;
let isError = false;

vi.mock("../../../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));

vi.mock("../../../../lib/hooks/ci", () => ({
  useCiRuns: () => ({ data: runs, isLoading: false, isError }),
}));

import { CiRunsView } from "./CiRunsView";

afterEach(() => {
  cleanup();
  runs = { items: [] };
  isError = false;
});

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ ci: messages }}>
      <CiRunsView />
    </NextIntlClientProvider>,
  );
}

describe("CiRunsView", () => {
  it("shows the empty CI Runs state rather than an error when there are no automated reviews (AC-48)", () => {
    runs = { items: [] };
    renderView();
    expect(screen.getByText("CI Runs")).toBeInTheDocument();
    expect(screen.getByText("No automated reviews yet")).toBeInTheDocument();
    expect(screen.queryByText("Could not load CI runs.")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows repository, PR, agent, verdict, findings, cost, duration, and a job link (AC-47)", () => {
    runs = {
      items: [
        {
          id: "r1",
          repository: "acme/payments-api",
          pr_number: 482,
          agent_id: "ag1",
          agent_name: "Security Reviewer",
          verdict: "fail",
          findings_count: 3,
          cost_usd: 0.042,
          duration_ms: 2100,
          job_url: "https://github.com/acme/payments-api/actions/runs/88",
          status: "succeeded",
          ran_at: "2026-08-30T10:00:00.000Z",
        },
      ],
    };
    renderView();
    expect(screen.getByRole("columnheader", { name: "Repository" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Pull request" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Agent" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Verdict" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Findings" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Cost" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Duration" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Job" })).toBeInTheDocument();
    expect(screen.getByText("acme/payments-api")).toBeInTheDocument();
    expect(screen.getByText("#482")).toBeInTheDocument();
    expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
    expect(screen.getByText("fail")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("$0.042")).toBeInTheDocument();
    expect(screen.getByText("2.1s")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View job" })).toHaveAttribute(
      "href",
      "https://github.com/acme/payments-api/actions/runs/88",
    );
  });
});
