import { describe, expect, it } from "vitest";
import { overlayRisksOnLines, lineIsRiskFocus, type DiffRiskMarker } from "./risks";
import type { Line } from "./helpers";

function lines(specs: Array<Partial<Line> & { kind: Line["kind"] }>): Line[] {
  return specs.map((s) => ({ text: "", ...s }));
}

describe("overlayRisksOnLines", () => {
  it("puts the icon on the start line (newNo) and not on later lines in the range", () => {
    const patch = lines([
      { kind: "ctx", oldNo: 11, newNo: 11 },
      { kind: "add", newNo: 12 },
      { kind: "add", newNo: 13 },
    ]);
    const risks: DiffRiskMarker[] = [
      { line: 12, endLine: 13, severity: "high", title: "Auth bypass" },
    ];
    const overlays = overlayRisksOnLines(patch, risks);
    expect(overlays[0]).toEqual([]);
    expect(overlays[1]!.map((r) => r.title)).toEqual(["Auth bypass"]);
    expect(overlays[2]).toEqual([]);
  });

  it("falls back to the first intersecting line when the exact start is outside the hunk", () => {
    const patch = lines([
      { kind: "hunk" },
      { kind: "ctx", oldNo: 100, newNo: 100 },
      { kind: "add", newNo: 101 },
    ]);
    const risks: DiffRiskMarker[] = [
      { line: 98, endLine: 100, severity: "medium", title: "Stale start" },
    ];
    const overlays = overlayRisksOnLines(patch, risks);
    expect(overlays[1]!.map((r) => r.title)).toEqual(["Stale start"]);
  });

  it("pins a path-only marker (line 0) to the first added line", () => {
    const patch = lines([
      { kind: "hunk" },
      { kind: "ctx", oldNo: 10, newNo: 10 },
      { kind: "add", newNo: 11 },
    ]);
    const overlays = overlayRisksOnLines(patch, [
      { line: 0, endLine: 0, severity: "high", title: "Auth bypass" },
    ]);
    expect(overlays[2]!.map((r) => r.title)).toEqual(["Auth bypass"]);
  });

  it("pins a cited line outside every hunk to the nearest rendered line", () => {
    const patch = lines([
      { kind: "hunk" },
      { kind: "add", newNo: 40 },
      { kind: "add", newNo: 41 },
    ]);
    const overlays = overlayRisksOnLines(patch, [
      { line: 12, endLine: 12, severity: "medium", title: "Far cite" },
    ]);
    expect(overlays[1]!.map((r) => r.title)).toEqual(["Far cite"]);
  });
});

describe("lineIsRiskFocus", () => {
  it("matches new or old line numbers and ignores hunk headers", () => {
    expect(lineIsRiskFocus({ kind: "add", text: "", newNo: 12 }, 12)).toBe(true);
    expect(lineIsRiskFocus({ kind: "del", text: "", oldNo: 12 }, 12)).toBe(true);
    expect(lineIsRiskFocus({ kind: "hunk", text: "@@" }, 12)).toBe(false);
  });
});
