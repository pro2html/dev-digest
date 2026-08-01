import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/en/prReview.json";
import { FindingsIndicator, type FindingsIndicatorItem } from "./FindingsIndicator";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const FINDINGS: FindingsIndicatorItem[] = [
  {
    title: "Hardcoded Stripe secret key in commit",
    severity: "CRITICAL",
    category: "security",
    file: "src/config.ts",
    start_line: 12,
    confidence: 0.98,
  },
  {
    title: "N+1 query in user list endpoint",
    severity: "WARNING",
    category: "perf",
    file: "src/api/users.ts",
    start_line: 45,
    confidence: 0.86,
  },
];

describe("FindingsIndicator", () => {
  it("renders '—' when there are no findings", () => {
    renderWithIntl(<FindingsIndicator critical={0} warning={0} suggestion={0} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("only shows counters for non-zero severities", () => {
    renderWithIntl(<FindingsIndicator critical={0} warning={2} suggestion={1} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("hover over the group (one parent) reveals a single card listing every finding", () => {
    renderWithIntl(
      <FindingsIndicator critical={1} warning={1} suggestion={0} findings={FINDINGS} />,
    );
    expect(screen.queryByText("Hardcoded Stripe secret key in commit")).not.toBeInTheDocument();

    const group = screen.getByTestId("findings-indicator");
    fireEvent.mouseEnter(group);
    expect(screen.getByText("Hardcoded Stripe secret key in commit")).toBeInTheDocument();
    expect(screen.getByText("N+1 query in user list endpoint")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts:12")).toBeInTheDocument();

    fireEvent.mouseLeave(group);
    expect(screen.queryByText("Hardcoded Stripe secret key in commit")).not.toBeInTheDocument();
  });

  it("shows a '+N more' footer when the preview is capped below the total", () => {
    renderWithIntl(
      <FindingsIndicator critical={5} warning={0} suggestion={0} findings={[FINDINGS[0]!]} />,
    );
    fireEvent.mouseEnter(screen.getByTestId("findings-indicator"));
    expect(screen.getByText("+ 4 more")).toBeInTheDocument();
  });
});
