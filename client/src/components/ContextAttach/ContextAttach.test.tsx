import { describe, it, expect, afterEach, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ContextCatalogFile } from "@devdigest/shared";
import messages from "../../../messages/en/context.json";
import { ContextAttach } from "./ContextAttach";
import { estimateTokens } from "@/components/SkillBodyEditor/helpers";

afterEach(cleanup);

const HUGE = "x".repeat(16_004); // ceil(16004/4) = 4001 > 4000
const EXACT = "x".repeat(16_000); // ceil(16000/4) = 4000

const CATALOG: ContextCatalogFile[] = [
  {
    path: "docs/api.md",
    category: "docs",
    content: "# API",
    size: 5,
    used_by_agents: 0,
  },
  {
    path: "specs/prd.md",
    category: "specs",
    content: HUGE,
    size: HUGE.length,
    used_by_agents: 1,
  },
  {
    path: "insights/gotchas.md",
    category: "insights",
    content: EXACT,
    size: EXACT.length,
    used_by_agents: 0,
  },
];

function renderAttach(
  props: Partial<ComponentProps<typeof ContextAttach>> = {},
) {
  const onChange = props.onChange ?? vi.fn();
  return render(
    <NextIntlClientProvider locale="en" messages={{ context: messages }}>
      <ContextAttach
        catalog={CATALOG}
        catalogLoading={false}
        attachedPaths={[]}
        onChange={onChange}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe("ContextAttach", () => {
  it("filters by file name or path case-insensitively and shows empty when nothing matches (AC-09)", () => {
    renderAttach({ inheritHint: true });
    expect(
      screen.getByText("Any agent that uses this skill inherits these documents."),
    ).toBeInTheDocument();
    expect(screen.getByText("api.md")).toBeInTheDocument();
    expect(screen.getByText("prd.md")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Filter documents…"), {
      target: { value: "API" },
    });
    expect(screen.getByText("api.md")).toBeInTheDocument();
    expect(screen.queryByText("prd.md")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Filter documents…"), {
      target: { value: "SPECS/" },
    });
    expect(screen.getByText("prd.md")).toBeInTheDocument();
    expect(screen.queryByText("api.md")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Filter documents…"), {
      target: { value: "zzz-no-match" },
    });
    expect(screen.getByText("No documents match this filter.")).toBeInTheDocument();
    expect(screen.queryByText("api.md")).not.toBeInTheDocument();
  });

  it("estimates tokens with ceil(chars/4), warns only when the scored set is over 4000 (AC-08, AC-23, AC-24)", () => {
    const { rerender } = renderAttach({ attachedPaths: ["docs/api.md"] });
    const apiTokens = estimateTokens("# API");
    expect(screen.getByText(`= ${apiTokens} tokens`)).toBeInTheDocument();
    expect(screen.queryByText(/This attached set is large/)).not.toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={{ context: messages }}>
        <ContextAttach
          catalog={CATALOG}
          catalogLoading={false}
          attachedPaths={["insights/gotchas.md"]}
          onChange={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("= 4000 tokens")).toBeInTheDocument();
    expect(screen.queryByText(/This attached set is large/)).not.toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={{ context: messages }}>
        <ContextAttach
          catalog={CATALOG}
          catalogLoading={false}
          attachedPaths={["docs/api.md"]}
          tokenPaths={["specs/prd.md"]}
          onChange={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("= 4001 tokens")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This attached set is large (~4001 tokens). Save and run still work; the full text will be injected.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("1 of 3 attached")).toBeInTheDocument();
  });

  it("counts inherited skill docs in the attached badge (agent ∪ skills)", () => {
    renderAttach({
      attachedPaths: ["docs/api.md"],
      tokenPaths: ["docs/api.md", "specs/prd.md", "insights/gotchas.md"],
    });
    expect(screen.getByText("3 of 3 attached")).toBeInTheDocument();
    expect(screen.getAllByText("via skill").length).toBe(2);
  });

  it("opens file preview in a right sidebar, not a modal", () => {
    renderAttach();
    fireEvent.click(screen.getAllByRole("button", { name: "Preview" })[0]!);
    expect(screen.getByRole("complementary", { name: "docs/api.md" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Injected as an untrusted block (## Project context) into every run.")).toBeInTheDocument();
  });
});
