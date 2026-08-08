import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ChangedSymbol, DownstreamImpact } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import { SymbolRow } from "./SymbolRow";

afterEach(cleanup);

const SYMBOL: ChangedSymbol = {
  name: "rateLimit",
  file: "src/middleware/rate-limit.ts",
  kind: "function",
};

const IMPACT: DownstreamImpact = {
  symbol: "rateLimit",
  callers: [
    { name: "handleRequest", file: "src/api/handler.ts", line: 42 },
  ],
  endpoints_affected: ["POST /api/checkout"],
  crons_affected: ["nightly-cleanup"],
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SymbolRow (smoke)", () => {
  it("renders symbol + deep-links callers to GitHub blob at head sha", () => {
    renderWithIntl(
      <SymbolRow
        symbol={SYMBOL}
        impact={IMPACT}
        defaultExpanded
        repoFullName="acme/app"
        headSha="abc123def"
      />,
    );

    expect(screen.getByText("rateLimit()")).toBeInTheDocument();
    expect(screen.getByText("POST /api/checkout")).toBeInTheDocument();
    expect(screen.getByText("nightly-cleanup")).toBeInTheDocument();

    const callerLink = screen.getByRole("link", { name: "src/api/handler.ts:42" });
    expect(callerLink).toHaveAttribute(
      "href",
      "https://github.com/acme/app/blob/abc123def/src/api/handler.ts#L42",
    );
  });
});
