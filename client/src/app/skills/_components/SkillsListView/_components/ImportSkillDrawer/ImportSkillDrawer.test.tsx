import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../../../lib/toast";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const mutateAsync = vi.fn();
vi.mock("../../../../../../lib/hooks/skills", () => ({
  useImportSkill: () => ({ mutateAsync, isPending: false }),
}));

import { ImportSkillDrawer } from "./ImportSkillDrawer";

afterEach(() => {
  cleanup();
  mutateAsync.mockReset();
  push.mockClear();
});

function renderDrawer() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <ImportSkillDrawer onClose={() => {}} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

function makeFile(name: string, content: string, type = "text/markdown") {
  return new File([content], name, { type });
}

describe("ImportSkillDrawer", () => {
  it("rejects non-markdown files with an inline error and does not import", async () => {
    renderDrawer();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("notes.txt", "hello", "text/plain");
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText("Only .md files are supported")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("previews markdown before import and only posts on confirm", async () => {
    const imported: Skill = {
      id: "sk-new",
      name: "api-contract",
      description: "",
      type: "convention",
      source: "imported_url",
      body: "# api-contract\nBreaking changes.",
      enabled: false,
      version: 1,
    };
    mutateAsync.mockResolvedValue(imported);

    renderDrawer();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("api-contract.md", "# api-contract\nBreaking changes.");
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Preview")).toBeInTheDocument();
    expect(screen.getByDisplayValue("api-contract")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Import skill"));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "# api-contract\nBreaking changes.",
        name: "api-contract",
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/skills/sk-new?tab=config"));
  });
});
