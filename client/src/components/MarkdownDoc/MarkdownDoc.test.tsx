import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MarkdownDoc } from "./MarkdownDoc";

afterEach(cleanup);

const SAMPLE = `# Title

Intro paragraph.

## Section

- first
- second
  - nested

1. numbered

> quoted note

\`inline\` and:

\`\`\`
block
\`\`\`

| Col | Val |
| --- | --- |
| a | 1 |
`;

describe("MarkdownDoc", () => {
  it("renders GitHub-like structure: headings, lists, quote, code, table", () => {
    render(<MarkdownDoc>{SAMPLE}</MarkdownDoc>);

    expect(screen.getByRole("heading", { level: 1, name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Section" })).toBeInTheDocument();
    expect(screen.getByText("Intro paragraph.")).toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("nested")).toBeInTheDocument();
    expect(screen.getByText("numbered")).toBeInTheDocument();
    expect(screen.getByText("quoted note")).toBeInTheDocument();
    expect(screen.getByText("inline")).toBeInTheDocument();
    expect(screen.getByText("block")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Col" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "1" })).toBeInTheDocument();
  });
});
