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
});
