import { describe, it, expect } from "vitest";
import { isGateSelected, isValidRepo } from "./helpers";

describe("CiTab helpers", () => {
  it("does not highlight Critical, Warning+, or Never when stored ci_fail_on is any (AC-08)", () => {
    expect(isGateSelected("any", "critical")).toBe(false);
    expect(isGateSelected("any", "warning")).toBe(false);
    expect(isGateSelected("any", "never")).toBe(false);
    expect(isGateSelected("critical", "critical")).toBe(true);
    expect(isGateSelected("warning", "warning")).toBe(true);
    expect(isGateSelected("never", "never")).toBe(true);
  });

  it("accepts owner/name and rejects empty or invalid repository strings (AC-13)", () => {
    expect(isValidRepo("acme/payments-api")).toBe(true);
    expect(isValidRepo("")).toBe(false);
    expect(isValidRepo("acme")).toBe(false);
    expect(isValidRepo("https://github.com/acme/api")).toBe(false);
  });
});
