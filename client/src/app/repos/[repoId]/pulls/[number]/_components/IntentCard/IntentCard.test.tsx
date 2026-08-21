import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrIntentRecord, WhyRiskBriefRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

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

const briefRecord: WhyRiskBriefRecord = {
  pr_id: "pr1",
  generated_for_sha: "abc",
  stale: false,
  brief: {
    what: "Adds a shared JWT parse helper.",
    why: "Login should not decode tokens inline.",
    risk_level: "high",
    risks: [
      {
        title: "Auth surface touched",
        explanation: "Limiter sits on the public auth path.",
        severity: "high",
        file_refs: ["src/middleware/ratelimit.ts:12-18"],
      },
      {
        title: "New dependency: ioredis",
        severity: "medium",
        file_refs: ["package.json:34"],
      },
    ],
    review_focus: [],
  },
};

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

import { IntentCard } from "./IntentCard";

afterEach(cleanup);

function renderCard(onFocusFile = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <IntentCard
        prId="pr1"
        changedPaths={["src/middleware/ratelimit.ts", "package.json"]}
        onFocusFile={onFocusFile}
      />
    </NextIntlClientProvider>,
  );
}

describe("IntentCard risk areas", () => {
  it("renders Risk areas inside Intent with clickable file refs (AC-05, AC-08)", () => {
    const onFocusFile = vi.fn();
    renderCard(onFocusFile);
    expect(screen.getByText("Risk areas")).toBeInTheDocument();
    expect(screen.getByText("Auth surface touched")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "src/middleware/ratelimit.ts:12-18" }));
    expect(onFocusFile).toHaveBeenCalledWith("src/middleware/ratelimit.ts", 12);
  });

  it("expands a risk explanation from the chevron", () => {
    renderCard();
    expect(screen.queryByText("Limiter sits on the public auth path.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Auth surface touched" }));
    expect(screen.getByText("Limiter sits on the public auth path.")).toBeInTheDocument();
  });
});
