import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CodeLine } from "./CodeLine";

afterEach(cleanup);

describe("CodeLine risk icons", () => {
  it("renders the Risk Areas icon on the right of the cited line", () => {
    render(
      <CodeLine
        ln={{ kind: "add", text: "return token;", newNo: 12 }}
        path="src/auth.ts"
        threads={[]}
        riskMarkers={[{ line: 12, endLine: 12, severity: "high", title: "Auth bypass" }]}
      />,
    );
    expect(screen.getByLabelText("Risk: Auth bypass")).toBeInTheDocument();
    expect(screen.getByTestId("diff-risk-icons")).toBeInTheDocument();
  });
});
