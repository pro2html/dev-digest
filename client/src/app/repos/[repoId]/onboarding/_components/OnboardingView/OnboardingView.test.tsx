import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { OnboardingTour } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import messages from "../../../../../../../messages/en/onboarding.json";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));

vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({
    activeRepo: { id: "r1", full_name: "acme/demo", default_branch: "main" },
  }),
}));

vi.mock("@/components/mermaid-diagram", () => ({
  MermaidDiagram: ({ chart }: { chart: string }) => <div data-testid="mermaid">{chart}</div>,
}));

let tour: OnboardingTour | undefined = {
  sections: [],
  generated_at: null,
  files_indexed: 0,
};
let isLoading = false;
let isError = false;
let generatePending = false;
let generateError: unknown = null;
const generateMutate = vi.fn();
const previewMutate = vi.fn();
const previewReset = vi.fn();
let previewData: { path: string; content: string } | undefined;
let previewPending = false;
let previewIsError = false;
let previewError: unknown = null;

vi.mock("@/lib/hooks/onboarding", () => ({
  useOnboarding: () => ({
    data: tour,
    isLoading,
    isError,
    error: undefined,
    refetch: vi.fn(),
  }),
  useGenerateOnboarding: () => ({
    mutate: generateMutate,
    isPending: generatePending,
    error: generateError,
    isSuccess: false,
  }),
  useOnboardingFile: () => ({
    mutate: previewMutate,
    reset: previewReset,
    data: previewData,
    isPending: previewPending,
    isError: previewIsError,
    error: previewError,
  }),
}));

import { OnboardingView } from "./OnboardingView";

afterEach(() => {
  cleanup();
  tour = { sections: [], generated_at: null, files_indexed: 0 };
  isLoading = false;
  isError = false;
  generatePending = false;
  generateError = null;
  generateMutate.mockClear();
  previewMutate.mockClear();
  previewReset.mockClear();
  previewData = undefined;
  previewPending = false;
  previewIsError = false;
  previewError = null;
});

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ onboarding: messages }}>
      <OnboardingView repoId="r1" />
    </NextIntlClientProvider>,
  );
}

function storedTour(overrides: Partial<OnboardingTour> = {}): OnboardingTour {
  return {
    generated_at: new Date().toISOString(),
    files_indexed: 12,
    sections: [
      {
        kind: "architecture",
        title: "Architecture overview",
        body: "How pieces connect.",
        links: [],
        layout: { name: "repo", children: [{ name: "server" }] },
      },
      {
        kind: "critical_paths",
        title: "Critical paths",
        body: "How work moves.",
        links: [],
        flows: [
          {
            title: "Run a review",
            steps: [
              { label: "Open the PR page", path: "client/src/page.tsx" },
              { label: "Click Run" },
            ],
          },
        ],
      },
      {
        kind: "local_setup",
        title: "How to run locally",
        body: "Install Node, then pnpm install.",
        links: [],
        commands: ["pnpm install"],
        env_vars: ["DATABASE_URL"],
      },
      {
        kind: "reading_path",
        title: "Guided reading path",
        body: "Start here.",
        links: [{ label: "Entry", path: "server/src/app.ts", note: "Boots Fastify" }],
      },
      {
        kind: "first_tasks",
        title: "First tasks",
        body: "Learn the stack.",
        links: [],
        tasks: [
          { title: "Run tests", complexity: "low" },
          { title: "Trace a review", complexity: "medium" },
          { title: "Ship a tiny fix", complexity: "high" },
        ],
      },
    ],
    ...overrides,
  };
}

describe("OnboardingView", () => {
  it("shows an empty Generate state and does not invent sections (AC-02)", () => {
    renderView();
    expect(screen.getByTestId("shell")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate onboarding tour" })).toBeInTheDocument();
    expect(screen.queryByText("Architecture overview")).not.toBeInTheDocument();
    expect(screen.queryByText("Critical paths")).not.toBeInTheDocument();
  });

  it("shows the stored tour title, subtitle, TOC, five sections, and all complexity badges (AC-04, AC-05, AC-07, AC-08, AC-09, AC-10, AC-12, AC-14, AC-15, AC-16, AC-32)", () => {
    tour = storedTour();
    renderView();
    expect(screen.getByRole("heading", { name: /Onboarding for demo/ })).toBeInTheDocument();
    expect(screen.getByText(/Generated from index of 12 files/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share link" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeInTheDocument();
    expect(screen.getAllByText("Architecture overview").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Critical paths").length).toBeGreaterThan(0);
    expect(screen.getAllByText("How to run locally").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Guided reading path").length).toBeGreaterThan(0);
    expect(screen.getAllByText("First tasks").length).toBeGreaterThan(0);
    expect(screen.getByText("How pieces connect.")).toBeInTheDocument();
    expect(screen.getByText("Where code lives")).toBeInTheDocument();
    expect(screen.getByText("server")).toBeInTheDocument();
    expect(screen.queryByTestId("mermaid")).not.toBeInTheDocument();
    expect(screen.getByText("Run a review")).toBeInTheDocument();
    expect(screen.getByText("Open the PR page")).toBeInTheDocument();
    expect(screen.getByText("pnpm install")).toBeInTheDocument();
    expect(screen.getByText("DATABASE_URL")).toBeInTheDocument();
    expect(screen.getByText("Start here")).toBeInTheDocument();
    expect(screen.getByText("Boots Fastify")).toBeInTheDocument();
    expect(
      screen.getByText(/Recommended work for someone who just joined/),
    ).toBeInTheDocument();
    expect(screen.getByText("Run tests")).toBeInTheDocument();
    expect(screen.getByText("Trace a review")).toBeInTheDocument();
    expect(screen.getByText("Ship a tiny fix")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders a mermaid diagram only on architecture when a chart is present (AC-06)", () => {
    const base = storedTour();
    tour = {
      ...base,
      sections: base.sections.map((s) =>
        s.kind === "architecture"
          ? { ...s, diagram: "flowchart LR\n  A-->B" }
          : s,
      ),
    };
    renderView();
    expect(screen.getByTestId("mermaid")).toHaveTextContent("flowchart LR");
  });

  it("keeps the previous tour on screen while regenerating (AC-18)", () => {
    tour = storedTour();
    generatePending = true;
    renderView();
    expect(screen.getByRole("heading", { name: /Onboarding for demo/ })).toBeInTheDocument();
    expect(screen.getAllByText("Regenerating…").length).toBeGreaterThan(0);
    expect(screen.getByText("How pieces connect.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate onboarding tour" })).not.toBeInTheDocument();
  });

  it("copies the current studio URL on Share link and shows copy-failed when clipboard throws (AC-19)", async () => {
    tour = storedTour();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Share link" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(window.location.href);
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });
    cleanup();

    writeText.mockRejectedValueOnce(new Error("denied"));
    tour = storedTour();
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Share link" }));
    expect(await screen.findByRole("button", { name: "Copy failed" })).toBeInTheDocument();
  });

  it("shows Open unavailable in the aside and keeps the tour page up (AC-29)", () => {
    tour = storedTour();
    previewIsError = true;
    previewError = new ApiError("File is unavailable", 404, "file_unavailable");
    renderView();
    fireEvent.click(screen.getAllByRole("button", { name: "Open" })[0]!);
    const aside = screen.getByRole("complementary");
    expect(within(aside).getByText("This file is unavailable in the clone.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Onboarding for demo/ })).toBeInTheDocument();
    expect(screen.getByText("How pieces connect.")).toBeInTheDocument();
  });

  it("keeps the previous tour when generate reports clone_unavailable (AC-22)", () => {
    tour = storedTour();
    generateError = new ApiError(
      "Repository clone is not available",
      409,
      "clone_unavailable",
    );
    renderView();
    expect(screen.getByRole("heading", { name: /Onboarding for demo/ })).toBeInTheDocument();
    expect(
      screen.getByText(
        "The repository clone is required to generate a tour. The previous tour is unchanged.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("How pieces connect.")).toBeInTheDocument();
  });

  it("renders every first task even when they share one complexity (AC-32)", () => {
    const base = storedTour();
    tour = {
      ...base,
      sections: base.sections.map((s) =>
        s.kind === "first_tasks"
          ? {
              ...s,
              tasks: [
                { title: "Read the entry file", complexity: "high" },
                { title: "Trace one review", complexity: "high" },
                { title: "Add a test", complexity: "high" },
              ],
            }
          : s,
      ),
    };
    renderView();
    expect(screen.getByText("Read the entry file")).toBeInTheDocument();
    expect(screen.getByText("Trace one review")).toBeInTheDocument();
    expect(screen.getByText("Add a test")).toBeInTheDocument();
    expect(screen.getAllByText("High")).toHaveLength(3);
    expect(screen.queryByText("Low")).not.toBeInTheDocument();
  });
});
