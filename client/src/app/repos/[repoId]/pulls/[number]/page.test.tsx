import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PrBlastRecord, PrDetail, PrIntentRecord, WhyRiskBriefRecord } from "@devdigest/shared";
import messages from "../../../../../../messages/en/prReview.json";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ repoId: "repo-1", number: "12" }),
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../../../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../../lib/repo-context", () => ({
  useActiveRepo: () => ({
    activeRepo: { id: "repo-1", full_name: "acme/app", default_branch: "main" },
  }),
  useRepoNotFound: () => false,
}));

vi.mock("./_components/PrDetailHeader", () => ({
  PrDetailHeader: () => <div data-testid="pr-header">header</div>,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const pr: PrDetail = {
  number: 12,
  title: "Add parseToken helper",
  author: "ada",
  branch: "feat/auth",
  base: "main",
  head_sha: "abc",
  additions: 4,
  deletions: 1,
  files_count: 1,
  status: "open",
  body: "PR body",
  files: [{ path: "src/auth.ts", additions: 4, deletions: 1 }],
  commits: [],
};

vi.mock("../../../../../lib/hooks", () => ({
  usePulls: () => ({
    data: [{ id: "pr1", number: 12 }],
    isLoading: false,
  }),
  usePullDetail: () => ({
    data: pr,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../../../../lib/hooks/reviews", () => ({
  usePrReviews: () => ({ data: [], refetch: vi.fn() }),
  useCancelRun: () => ({ mutate: vi.fn() }),
  usePrActiveRuns: () => ({ data: [] }),
  usePrRuns: () => ({ data: [] }),
  useDeleteRun: () => ({ mutate: vi.fn() }),
}));

vi.mock("../../../../../lib/hooks/multi-agent", () => ({
  useMultiAgentRunsForPull: () => ({ data: { pr_id: "pr1", runs: [] } }),
}));

vi.mock("@/lib/hooks/multi-agent", () => ({
  useMultiAgentRunsForPull: () => ({ data: { pr_id: "pr1", runs: [] } }),
}));

const briefRecord: WhyRiskBriefRecord = {
  pr_id: "pr1",
  generated_for_sha: "abc",
  stale: false,
  brief: {
    what: "Adds a shared JWT parse helper.",
    why: "Login should not decode tokens inline.",
    risk_level: "medium",
    risks: [{ title: "Auth bypass", file_refs: ["src/auth.ts"] }],
    review_focus: [
      { path: "src/auth.ts", line_start: 12, reason: "New helper" },
      { path: "src/gone.ts", reason: "Left the diff" },
    ],
  },
};

const intentRecord: PrIntentRecord = {
  pr_id: "pr1",
  intent: "Share JWT parse",
  in_scope: ["auth"],
  out_of_scope: [],
  context_quality: "high",
  missing_context: [],
  sources: null,
  stale: false,
};

const blastRecord: PrBlastRecord = {
  status: "ok",
  summary: "empty",
  changed_symbols: [],
  downstream: [],
};

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
  useDerivePrIntent: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/lib/hooks/blast", () => ({
  usePrBlast: () => ({
    data: blastRecord,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import PRDetailPage from "./page";

afterEach(() => {
  cleanup();
  replace.mockClear();
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <PRDetailPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("PR detail Risk areas focus", () => {
  it("risk file citation sets tab=diff and file query (AC-07, AC-08)", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "src/auth.ts" }));
    expect(replace).toHaveBeenCalledTimes(1);
    const url = decodeURIComponent(String(replace.mock.calls[0]?.[0]));
    expect(url).toContain("tab=diff");
    expect(url).toContain("file=src/auth.ts");
  });
});
