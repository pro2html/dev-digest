import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrBlastRecord, PrIntentRecord, WhyRiskBriefRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

const briefRecord: WhyRiskBriefRecord = {
  pr_id: "pr1",
  generated_for_sha: "abc",
  stale: false,
  brief: {
    what: "Adds a shared JWT parse helper.",
    why: "Login should not decode tokens inline.",
    risk_level: "high",
    risks: [{ title: "Auth bypass", file_refs: ["src/auth.ts"] }],
    review_focus: [{ path: "src/auth.ts", line_start: 12, reason: "New helper" }],
  },
};

const intentRecord: PrIntentRecord = {
  pr_id: "pr1",
  intent: "Share JWT parse",
  in_scope: ["auth"],
  out_of_scope: ["docs"],
  context_quality: "high",
  missing_context: [],
  sources: null,
  stale: false,
};

const blastRecord: PrBlastRecord = {
  status: "ok",
  summary: "1 symbol · 0 callers · 0 endpoints · 0 crons",
  changed_symbols: [{ name: "parseToken", file: "src/auth.ts", kind: "function" }],
  downstream: [],
  totals: { symbols: 1, callers: 0, endpoints: 0, crons: 0 },
};

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/hooks/brief", () => ({
  usePrBrief: () => ({
    data: briefRecord,
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  }),
  useGeneratePrBrief: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));

vi.mock("@/lib/hooks/intent", () => ({
  usePrIntent: () => ({
    data: intentRecord,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useDerivePrIntent: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/lib/hooks/blast", () => ({
  usePrBlast: () => ({
    data: blastRecord,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import { OverviewTab } from "./OverviewTab";

afterEach(cleanup);

function renderTab(onFocusFile = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <OverviewTab
        prId="pr1"
        repoId="repo-1"
        prBody="PR description body"
        repoFullName="acme/app"
        headSha="abc"
        changedPaths={["src/auth.ts"]}
        onFocusFile={onFocusFile}
      />
    </NextIntlClientProvider>,
  );
}

describe("OverviewTab", () => {
  it("shows Intent with Risk areas beside Blast and has no Why+Risk card (AC-01)", () => {
    const onFocusFile = vi.fn();
    renderTab(onFocusFile);
    expect(screen.queryByText("Why + risk")).not.toBeInTheDocument();
    expect(screen.queryByText("Generate brief")).not.toBeInTheDocument();
    expect(screen.getByText("Intent")).toBeInTheDocument();
    expect(screen.getByText(/Share JWT parse/)).toBeInTheDocument();
    expect(screen.getByText("Risk areas")).toBeInTheDocument();
    expect(screen.getByText("Auth bypass")).toBeInTheDocument();
    expect(screen.getByText("Blast radius")).toBeInTheDocument();
    expect(screen.getByText("parseToken()")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "src/auth.ts" }));
    expect(onFocusFile).toHaveBeenCalledWith("src/auth.ts", undefined);
  });
});
