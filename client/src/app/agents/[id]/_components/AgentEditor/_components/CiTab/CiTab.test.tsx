import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/ci.json";
import type { CiInstallationRow, CiRunRow } from "../../../../../../../lib/hooks/ci";

const updateMutate = vi.fn();
const previewMutate = vi.fn();
const prepareMutate = vi.fn();
const openPrMutate = vi.fn();
const zipMutate = vi.fn();

let installs: { items: CiInstallationRow[] } = { items: [] };
let runs: { items: CiRunRow[] } = { items: [] };

vi.mock("../../../../../../../lib/hooks/agents", () => ({
  useUpdateAgent: () => ({ mutate: updateMutate, isPending: false }),
}));

vi.mock("../../../../../../../lib/hooks/ci", () => ({
  useCiInstallations: () => ({ data: installs, isLoading: false, isError: false }),
  useCiRuns: () => ({ data: runs, isLoading: false, isError: false }),
  useCiPreview: () => ({ mutateAsync: previewMutate, isPending: false }),
  useCiPrepareInstall: () => ({ mutateAsync: prepareMutate, isPending: false }),
  useCiExportOpenPr: () => ({ mutateAsync: openPrMutate, isPending: false }),
  useCiExportZip: () => ({ mutateAsync: zipMutate, isPending: false }),
}));

vi.mock("../../../../../../../lib/repo-context", () => ({
  useActiveRepo: () => ({
    activeRepo: { full_name: "acme/connected-repo", default_branch: "main" },
  }),
}));

import { CiTab } from "./CiTab";

afterEach(() => {
  cleanup();
  updateMutate.mockClear();
  previewMutate.mockReset();
  prepareMutate.mockReset();
  openPrMutate.mockReset();
  zipMutate.mockReset();
  installs = { items: [] };
  runs = { items: [] };
});

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You review.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

function renderTab(agent: Agent = AGENT) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ ci: messages }}>
      <CiTab agent={agent} />
    </NextIntlClientProvider>,
  );
}

describe("CiTab", () => {
  it("shows CI deployment chrome, active-repo count, + Add to CI, Fail CI on, and the empty state (AC-01, AC-04)", () => {
    renderTab();
    expect(screen.getByText("CI deployment")).toBeInTheDocument();
    expect(screen.getByText("Active in 0 repos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add to CI" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Fail CI on" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Critical" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Warning+" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Never" })).toBeInTheDocument();
    expect(screen.getByText(/Not deployed to CI yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add repository" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update CI config" })).not.toBeInTheDocument();
    expect(screen.queryByText(/View pull request/i)).not.toBeInTheDocument();
  });

  it("opens the Export to CI wizard at Target from + Add to CI (AC-02, AC-10, AC-11)", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "+ Add to CI" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Export to CI")).toBeInTheDocument();
    expect(within(dialog).getByText("Target")).toBeInTheDocument();
    expect(within(dialog).getByText("Preview")).toBeInTheDocument();
    expect(within(dialog).getByText("Configure")).toBeInTheDocument();
    expect(within(dialog).getByText("Install")).toBeInTheDocument();
    expect(within(dialog).getByText("GitHub Actions")).toBeInTheDocument();
    expect(within(dialog).queryByText(/CircleCI/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Jenkins/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Generic CLI/i)).not.toBeInTheDocument();
  });

  it("lists each installation with repo, GitHub Actions, status, time, version, and per-row Update CI config (AC-03, AC-05, AC-06)", async () => {
    installs = {
      items: [
        {
          id: "inst1",
          agent_id: "ag1",
          repo: "acme/payments-api",
          target_type: "gha",
          installed_at: "2026-08-01T00:00:00.000Z",
          last_status: "succeeded",
          last_activity_at: new Date().toISOString(),
          exported_agent_version: "3",
        },
      ],
    };
    renderTab();
    expect(screen.getByText("Active in 1 repos")).toBeInTheDocument();
    expect(screen.getByText("acme/payments-api")).toBeInTheDocument();
    expect(screen.getByText(/GitHub Actions/)).toBeInTheDocument();
    expect(screen.getByText(/succeeded/)).toBeInTheDocument();
    expect(screen.getByText(/v3/)).toBeInTheDocument();
    const update = screen.getByRole("button", { name: "Update CI config" });
    fireEvent.click(update);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByDisplayValue("acme/payments-api")).toBeInTheDocument();
  });

  it("persists Fail CI on as critical/warning/never and leaves any unselected until the user picks (AC-07, AC-08)", () => {
    const { rerender } = renderTab({ ...AGENT, ci_fail_on: "any" });
    expect(screen.getByRole("button", { name: "Critical" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Warning+" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Never" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Warning+" }));
    expect(updateMutate).toHaveBeenCalledWith({ id: "ag1", patch: { ci_fail_on: "warning" } });

    rerender(
      <NextIntlClientProvider locale="en" messages={{ ci: messages }}>
        <CiTab agent={{ ...AGENT, ci_fail_on: "critical" }} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Critical" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Never" }));
    expect(updateMutate).toHaveBeenCalledWith({ id: "ag1", patch: { ci_fail_on: "never" } });
  });

  it("shows CI-sourced history with status, time, and repo, not a local-only empty table (AC-09)", () => {
    runs = {
      items: [
        {
          id: "run-ci",
          repository: "acme/payments-api",
          pr_number: 12,
          agent_id: "ag1",
          agent_name: "Security Reviewer",
          verdict: "fail",
          findings_count: 2,
          cost_usd: 0.1,
          duration_ms: 1200,
          job_url: "https://github.com/acme/payments-api/actions/runs/1",
          status: "succeeded",
          ran_at: new Date().toISOString(),
        },
      ],
    };
    renderTab();
    expect(screen.getByText("CI history")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();
    expect(screen.getByText("acme/payments-api")).toBeInTheDocument();
  });
});
