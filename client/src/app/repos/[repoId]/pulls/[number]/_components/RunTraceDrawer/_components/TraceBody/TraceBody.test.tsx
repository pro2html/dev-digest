import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunTrace } from "@devdigest/shared";
import messages from "../../../../../../../../../../messages/en/runs.json";
import { TraceBody } from "./TraceBody";

afterEach(cleanup);

const TRACE: RunTrace = {
  config: {
    agent: "Security",
    version: "1",
    provider: "openai",
    model: "gpt-4.1",
    pr: 482,
    source: "local",
  },
  stats: {
    duration_ms: 8200,
    tokens_in: 12000,
    tokens_out: 1500,
    cost_usd: 0.0142,
    findings: 0,
    grounding: "0/0 passed",
  },
  prompt_assembly: {
    system: "You are a reviewer.",
    skills: null,
    memory: null,
    specs:
      '<untrusted source="spec-0">\n### docs/api.md\n# api\n</untrusted>\n\n<untrusted source="spec-1">\n### specs/prd.md\n# prd\n</untrusted>',
    user: "Review PR #482",
  },
  tool_calls: [],
  raw_output: "{}",
  memory_pulled: [],
  specs_read: ["docs/api.md", "specs/prd.md"],
  log: [],
};

function renderBody(trace: RunTrace = TRACE) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ runs: messages }}>
      <TraceBody trace={trace} findings={[]} />
    </NextIntlClientProvider>,
  );
}

describe("TraceBody project context", () => {
  it("lists specs_read and labels Prompt Assembly specs as attached untrusted (AC-15, AC-16)", () => {
    renderBody();
    expect(screen.getAllByText("docs/api.md").length).toBeGreaterThan(0);
    expect(screen.getAllByText("specs/prd.md").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Project context — attached specs (untrusted)"),
    ).toBeInTheDocument();
  });

  it("shows a Project Context section with file names, token footer, and sidebar preview", () => {
    renderBody();
    expect(screen.getByText("Project Context")).toBeInTheDocument();
    expect(screen.getByText("= 4 tokens")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Preview" })[0]!);
    expect(screen.getByRole("complementary", { name: "docs/api.md" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
