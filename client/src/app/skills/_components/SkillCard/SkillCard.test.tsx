import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { SkillCard } from "./SkillCard";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "test-coverage-nudge",
  description: "Nudges for missing coverage",
  type: "custom",
  source: "manual",
  body: "# Coverage\nCheck branches.",
  enabled: true,
  version: 2,
  used_by_agents: 3,
};

function renderWithIntl(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("SkillCard", () => {
  it("renders name, type, source and metrics from used_by_agents", () => {
    renderWithIntl(<SkillCard skill={SKILL} />);
    expect(screen.getByText("test-coverage-nudge")).toBeInTheDocument();
    expect(screen.getByText("custom")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("3 agents · —% pull · —% accept")).toBeInTheDocument();
  });

  it("falls back to a translated placeholder when description is empty", () => {
    renderWithIntl(<SkillCard skill={{ ...SKILL, description: "" }} />);
    expect(screen.getByText("No description")).toBeInTheDocument();
  });

  it("shows needs-vetting badge for disabled non-manual skills", () => {
    renderWithIntl(
      <SkillCard skill={{ ...SKILL, source: "imported_url", enabled: false }} />,
    );
    expect(screen.getByText("needs vetting")).toBeInTheDocument();
    expect(screen.getByText("Imported")).toBeInTheDocument();
  });
});
