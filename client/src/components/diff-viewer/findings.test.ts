import { describe, expect, it } from "vitest";
import { overlayFindingsOnLines, type DiffFindingMarker } from "./findings";
import type { Line } from "./helpers";

function lines(specs: Array<Partial<Line> & { kind: Line["kind"] }>): Line[] {
  return specs.map((s) => ({ text: "", ...s }));
}

describe("overlayFindingsOnLines", () => {
  it("puts a word-link on each finding start (newNo) and never collapses same-line starts", () => {
    const patch = lines([
      { kind: "ctx", oldNo: 60, newNo: 60 },
      { kind: "add", newNo: 61 },
      { kind: "add", newNo: 68 },
      { kind: "add", newNo: 73 },
    ]);
    const findings: DiffFindingMarker[] = [
      { id: "a", line: 61, endLine: 61, severity: "CRITICAL" },
      { id: "b", line: 68, endLine: 68, severity: "CRITICAL" },
      { id: "c", line: 73, endLine: 73, severity: "CRITICAL" },
    ];
    const overlays = overlayFindingsOnLines(patch, findings);
    expect(overlays[1]!.links.map((m) => m.id)).toEqual(["a"]);
    expect(overlays[2]!.links.map((m) => m.id)).toEqual(["b"]);
    expect(overlays[3]!.links.map((m) => m.id)).toEqual(["c"]);
  });

  it("anchors deletions via oldNo and keeps two links when two findings share a start line", () => {
    const patch = lines([
      { kind: "del", oldNo: 56 },
      { kind: "add", newNo: 56 },
    ]);
    const findings: DiffFindingMarker[] = [
      { id: "x", line: 56, endLine: 56, severity: "CRITICAL" },
      { id: "y", line: 56, endLine: 58, severity: "WARNING" },
    ];
    const overlays = overlayFindingsOnLines(patch, findings);
    // Both del(old 56) and add(new 56) match start — links on first match (del).
    expect(overlays[0]!.links.map((m) => m.id)).toEqual(["x", "y"]);
    expect(overlays[0]!.stripe).toBe("CRITICAL");
    // add newNo=56 also intersects both findings → worst stripe CRITICAL
    expect(overlays[1]!.stripe).toBe("CRITICAL");
  });

  it("falls back to first intersecting line when exact start is outside the hunk", () => {
    const patch = lines([
      { kind: "hunk" },
      { kind: "ctx", oldNo: 100, newNo: 100 },
      { kind: "del", oldNo: 101 },
    ]);
    const findings: DiffFindingMarker[] = [
      { id: "z", line: 98, endLine: 100, severity: "CRITICAL" },
    ];
    const overlays = overlayFindingsOnLines(patch, findings);
    expect(overlays[1]!.links.map((m) => m.id)).toEqual(["z"]);
    expect(overlays[1]!.stripe).toBe("CRITICAL");
  });
});
