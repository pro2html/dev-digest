import { describe, it, expect } from "vitest";
import { activeKeyFor } from "./helpers";

describe("activeKeyFor (AC-28)", () => {
  it("maps the repo-scoped tour page to onboarding-tour (AC-28)", () => {
    expect(activeKeyFor("/repos/abc/onboarding")).toBe("onboarding-tour");
    expect(activeKeyFor("/repos/abc/onboarding/")).toBe("onboarding-tour");
  });

  it("does not treat add-repository /onboarding as Onboarding Tour (AC-28)", () => {
    expect(activeKeyFor("/onboarding")).toBe("");
    expect(activeKeyFor("/onboarding/")).toBe("");
  });

  it("maps /eval and /eval/:id to the eval nav key (AC-41)", () => {
    expect(activeKeyFor("/eval")).toBe("eval");
    expect(activeKeyFor("/eval/abc")).toBe("eval");
  });

  it("maps /ci-runs to the ci-runs nav key (AC-46)", () => {
    expect(activeKeyFor("/ci-runs")).toBe("ci-runs");
    expect(activeKeyFor("/ci-runs/")).toBe("ci-runs");
  });
});
