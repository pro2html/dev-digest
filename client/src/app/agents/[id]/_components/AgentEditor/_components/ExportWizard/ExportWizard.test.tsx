import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, CiFile } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/ci.json";

const previewMutate = vi.fn();
const prepareMutate = vi.fn();
const openPrMutate = vi.fn();
const zipMutate = vi.fn();
let activeFullName: string | undefined = "acme/connected-repo";

vi.mock("../../../../../../../lib/hooks/ci", () => ({
  useCiPreview: () => ({ mutateAsync: previewMutate, isPending: false }),
  useCiPrepareInstall: () => ({ mutateAsync: prepareMutate, isPending: false }),
  useCiExportOpenPr: () => ({ mutateAsync: openPrMutate, isPending: false }),
  useCiExportZip: () => ({ mutateAsync: zipMutate, isPending: false }),
}));

vi.mock("../../../../../../../lib/repo-context", () => ({
  useActiveRepo: () => ({
    activeRepo: activeFullName
      ? { full_name: activeFullName, default_branch: "main" }
      : null,
  }),
}));

import { ExportWizard } from "./ExportWizard";

const FILES: CiFile[] = [
  { path: ".devdigest/agents/security-reviewer.yaml", contents: "name: Security Reviewer\n", editable: false },
  { path: ".devdigest/memory.jsonl", contents: "# no workspace memory yet\n", editable: false },
  {
    path: ".github/workflows/devdigest-review.yml",
    contents: "name: DevDigest review\nrun: node .devdigest/runner.mjs review --agent security-reviewer\n",
    editable: true,
  },
  { path: ".devdigest/runner.mjs", contents: "#!/usr/bin/env node\n", editable: false },
];

afterEach(() => {
  cleanup();
  previewMutate.mockReset();
  prepareMutate.mockReset();
  openPrMutate.mockReset();
  zipMutate.mockReset();
  activeFullName = "acme/connected-repo";
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

function renderWizard(initialRepo?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ ci: messages }}>
      <ExportWizard agent={AGENT} initialRepo={initialRepo} onClose={() => {}} />
    </NextIntlClientProvider>,
  );
}

async function dialog() {
  return screen.findByRole("dialog");
}

async function goToPreview() {
  previewMutate.mockResolvedValue({ files: FILES });
  const d = await dialog();
  fireEvent.click(within(d).getByRole("button", { name: "Continue" }));
  await screen.findByText(".devdigest/runner.mjs");
}

async function goToConfigure() {
  await goToPreview();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Post results as");
}

async function goToInstall(prep: { ingest_token?: string; ingest_secret_name: string; token_minted: boolean }) {
  prepareMutate.mockResolvedValue(prep);
  await goToConfigure();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("button", { name: "Open a PR with these files" });
}

describe("ExportWizard", () => {
  it("shows four steps, GitHub Actions only, defaults the connected repo, and refuses invalid owner/name (AC-10, AC-11, AC-12, AC-13)", async () => {
    renderWizard();
    const d = await dialog();
    expect(within(d).getByText("Target")).toBeInTheDocument();
    expect(within(d).getByText("Preview")).toBeInTheDocument();
    expect(within(d).getByText("Configure")).toBeInTheDocument();
    expect(within(d).getByText("Install")).toBeInTheDocument();
    expect(within(d).getByText("GitHub Actions")).toBeInTheDocument();
    expect(within(d).queryByText(/CircleCI/i)).not.toBeInTheDocument();
    expect(within(d).queryByText(/Jenkins/i)).not.toBeInTheDocument();
    expect(within(d).getByDisplayValue("acme/connected-repo")).toBeInTheDocument();

    const input = within(d).getByPlaceholderText("acme/payments-api");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(within(d).getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("A valid repository (owner/name) is required.")).toBeInTheDocument();
    expect(previewMutate).not.toHaveBeenCalled();
  });

  it("continues to Preview with GHA + valid repo and lists generated files including the runner (AC-14, AC-15, AC-16, AC-18)", async () => {
    renderWizard();
    await goToPreview();
    expect(previewMutate).toHaveBeenCalledWith(
      expect.objectContaining({ repo: "acme/connected-repo", target: "gha" }),
    );
    expect(screen.getByText(".devdigest/agents/security-reviewer.yaml")).toBeInTheDocument();
    expect(screen.getByText(".devdigest/memory.jsonl")).toBeInTheDocument();
    expect(screen.getByText(".github/workflows/devdigest-review.yml · editable")).toBeInTheDocument();
    expect(screen.getByText(".devdigest/runner.mjs")).toBeInTheDocument();
    const editor = screen.getByRole("textbox");
    expect(editor).toHaveAttribute("readOnly");
  });

  it("marks the workflow editable, keeps other files read-only, and Back returns to Target without installing (AC-17, AC-18, AC-24)", async () => {
    renderWizard();
    await goToPreview();
    fireEvent.click(screen.getByText(".github/workflows/devdigest-review.yml · editable"));
    const editor = screen.getByRole("textbox");
    expect(editor).not.toHaveAttribute("readOnly");
    fireEvent.change(editor, { target: { value: "name: edited\n" } });
    expect(editor).toHaveValue("name: edited\n");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByPlaceholderText("acme/payments-api")).toBeInTheDocument();
    expect(openPrMutate).not.toHaveBeenCalled();
    expect(zipMutate).not.toHaveBeenCalled();
  });

  it("defaults Configure triggers and post-as, states no GitHub App, and Continue reaches Install (AC-25, AC-26, AC-27, AC-28)", async () => {
    renderWizard();
    await goToConfigure();
    expect(screen.getByRole("checkbox", { name: "opened" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "synchronize" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "reopened" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /GitHub review/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /PR comment/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /None \(exit code only\)/ })).toBeInTheDocument();
    expect(screen.getByText(/No GitHub App is required/)).toBeInTheDocument();
    expect(screen.getByText(/required status check/)).toBeInTheDocument();
  });

  it("offers Open a PR and zip on Install, names secrets, and shows the first ingest token once (AC-29, AC-35, AC-53)", async () => {
    renderWizard();
    await goToInstall({
      ingest_token: "token-plain-once",
      ingest_secret_name: "DEVDIGEST_INGEST_TOKEN",
      token_minted: true,
    });
    expect(screen.getByRole("button", { name: "Open a PR with these files" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download zip" })).toBeInTheDocument();
    expect(screen.getByText(/Add DevDigest CI review/)).toBeInTheDocument();
    expect(screen.getByText(/OPENAI_API_KEY/)).toBeInTheDocument();
    expect(screen.getByText(/DEVDIGEST_INGEST_TOKEN/)).toBeInTheDocument();
    expect(screen.getByText(/Actions supplies GITHUB_TOKEN/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("token-plain-once")).toBeInTheDocument();
  });

  it("names the existing ingest secret on later Install and does not mint a second token (AC-54)", async () => {
    renderWizard();
    await goToInstall({ ingest_secret_name: "DEVDIGEST_INGEST_TOKEN", token_minted: false });
    expect(screen.getByText(/Use the existing Actions secret named DEVDIGEST_INGEST_TOKEN/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/token-plain/)).not.toBeInTheDocument();
  });

  it("Back on Install returns to Configure without installing (AC-36)", async () => {
    renderWizard();
    await goToInstall({ ingest_secret_name: "DEVDIGEST_INGEST_TOKEN", token_minted: false });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Post results as")).toBeInTheDocument();
    expect(openPrMutate).not.toHaveBeenCalled();
    expect(zipMutate).not.toHaveBeenCalled();
  });

  it("Open a PR shows the PR URL on success; zip downloads without claiming an install (AC-29, AC-34)", async () => {
    openPrMutate.mockResolvedValue({
      pr_url: "https://github.com/acme/connected-repo/pull/9",
      ingest_secret_name: "DEVDIGEST_INGEST_TOKEN",
      installation: { id: "i1", agent_id: "ag1", repo: "acme/connected-repo", target_type: "gha", installed_at: "2026-08-01T00:00:00Z" },
      files: FILES,
    });
    const blob = new Blob(["PK"]);
    zipMutate.mockResolvedValue(blob);
    const createObjectURL = vi.fn(() => "blob:ci-zip");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderWizard();
    await goToInstall({ ingest_secret_name: "DEVDIGEST_INGEST_TOKEN", token_minted: false });
    fireEvent.click(screen.getByRole("button", { name: "Open a PR with these files" }));
    expect(await screen.findByRole("link", { name: "View pull request" })).toHaveAttribute(
      "href",
      "https://github.com/acme/connected-repo/pull/9",
    );
    fireEvent.click(screen.getByRole("button", { name: "Download zip" }));
    await waitFor(() => expect(zipMutate).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
