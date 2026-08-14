import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ContextCatalogFile } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import messages from "../../../../../../../messages/en/context.json";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));

let files: ContextCatalogFile[] | undefined = [];
let isLoading = false;
let isError = false;
let error: unknown;
const refetch = vi.fn(async () => undefined);
const importMutate = vi.fn();

vi.mock("@/lib/hooks", () => ({
  useContextFiles: () => ({
    data: files,
    isLoading,
    isError,
    error,
    refetch,
    isFetching: false,
    dataUpdatedAt: Date.now(),
  }),
  useImportContextFile: () => ({
    mutateAsync: importMutate,
    isPending: false,
  }),
}));

import { ContextView } from "./ContextView";

afterEach(() => {
  cleanup();
  files = [];
  isLoading = false;
  isError = false;
  error = undefined;
  refetch.mockClear();
  importMutate.mockReset();
});

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ context: messages }}>
      <ContextView repoId="r1" />
    </NextIntlClientProvider>,
  );
}

function makeFile(name: string, content: string, type = "text/markdown") {
  return new File([content], name, { type });
}

describe("ContextView", () => {
  it("shows the empty catalog state when the clone has no matching markdown (AC-02)", () => {
    files = [];
    renderView();
    expect(screen.getByTestId("shell")).toBeInTheDocument();
    expect(screen.getByText("No documents found")).toBeInTheDocument();
    expect(
      screen.getByText("No markdown files under specs/, docs/, or insights/ in this clone."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Catalog unavailable")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add file" })).toBeInTheDocument();
  });

  it("shows catalog unavailable when the API returns clone_unavailable (AC-20)", () => {
    files = undefined;
    isError = true;
    error = new ApiError("Repository clone is not available", 409, "clone_unavailable");
    renderView();
    expect(screen.getByTestId("shell")).toBeInTheDocument();
    expect(screen.getByText("Catalog unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The repository clone is not available yet. Wait for the clone to finish, then refresh.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("No documents found")).not.toBeInTheDocument();
  });

  it("shows used-by counts in the preview header (AC-04)", () => {
    files = [
      {
        path: "docs/api.md",
        category: "docs",
        content: "# api",
        used_by_agents: 0,
      },
      {
        path: "specs/prd.md",
        category: "specs",
        content: "# prd",
        used_by_agents: 2,
      },
    ];
    renderView();
    expect(screen.getByText("Used by 0 agents")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /specs\/prd\.md/ }));
    expect(screen.getByText("Used by 2 agents")).toBeInTheDocument();
  });

  it("shows a labeled coverage ring and preview/edit toggle in the preview header", () => {
    files = [
      {
        path: "docs/api.md",
        category: "docs",
        content: "# api",
        used_by_agents: 0,
      },
      {
        path: "specs/prd.md",
        category: "specs",
        content: "# prd",
        used_by_agents: 1,
      },
    ];
    renderView();
    expect(screen.getByLabelText("Coverage 50 percent")).toBeInTheDocument();
    expect(screen.getByText("Coverage")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Edit" }));
    expect(screen.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Edit")).toHaveValue("# api");
  });

  it("saves a picked markdown file into docs/imported-context via the API", async () => {
    files = [
      {
        path: "docs/api.md",
        category: "docs",
        content: "# api",
        used_by_agents: 0,
      },
    ];
    importMutate.mockImplementation(async ({ filename, content }: { filename: string; content: string }) => {
      const row: ContextCatalogFile = {
        path: `docs/imported-context/${filename}`,
        category: "docs",
        content,
        used_by_agents: 0,
      };
      files = [...(files ?? []), row];
      return row;
    });
    renderView();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile("notes.md", "# picked notes")] },
    });
    await waitFor(() => {
      expect(importMutate).toHaveBeenCalledWith({
        repoId: "r1",
        filename: "notes.md",
        content: "# picked notes",
      });
    });
    expect(await screen.findByRole("button", { name: /docs\/imported-context\/notes\.md/ })).toBeInTheDocument();
    expect(screen.getByText("picked notes")).toBeInTheDocument();
  });

  it("rejects a non-markdown file with an inline error", async () => {
    files = [
      {
        path: "docs/api.md",
        category: "docs",
        content: "# api",
        used_by_agents: 0,
      },
    ];
    renderView();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile("notes.txt", "hello", "text/plain")] },
    });
    expect(await screen.findByText("Only .md files are supported")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /notes\.txt/ })).not.toBeInTheDocument();
  });
});
