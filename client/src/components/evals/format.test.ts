import { describe, expect, it } from "vitest";
import { formatCost, formatDuration, formatPct } from "./format";

describe("eval formatters", () => {
  it('renders a zero-denominator metric as "n/a" rather than 100% (AC-29)', () => {
    expect(formatPct(1, true)).toBe("n/a");
    expect(formatPct(1, false)).toBe("100%");
    expect(formatPct(0.42)).toBe("42%");
  });

  it("formats cost and duration for run-on-save results (AC-09)", () => {
    expect(formatCost(0.0123)).toBe("$0.01");
    expect(formatCost(0.0042)).toBe("$0.0042");
    expect(formatDuration(1500)).toBe("1.5s");
  });
});
