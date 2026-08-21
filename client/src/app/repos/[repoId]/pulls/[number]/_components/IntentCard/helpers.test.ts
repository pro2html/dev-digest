import { describe, it, expect } from "vitest";
import { citationTarget, isChangedPath, parseFileRef, buildRiskMarkersByPath } from "./helpers";
import type { WhyRiskItem } from "@devdigest/shared";

describe("IntentCard citation helpers", () => {
  it("parses optional :line / :start-end suffixes", () => {
    expect(parseFileRef("src/auth.ts:12")).toEqual({ path: "src/auth.ts", lineStart: 12 });
    expect(parseFileRef("./src/auth.ts:10-20")).toEqual({
      path: "src/auth.ts",
      lineStart: 10,
      lineEnd: 20,
    });
  });

  it("treats blast endpoints and missing paths as non-navigating labels (AC-08, AC-26)", () => {
    const changed = new Set(["src/auth.ts"]);
    expect(citationTarget("src/auth.ts:12", changed)).toEqual({
      kind: "file",
      path: "src/auth.ts",
      line: 12,
    });
    expect(citationTarget("POST /login", changed)).toEqual({
      kind: "label",
      text: "POST /login",
    });
    expect(isChangedPath("src/gone.ts", changed)).toBe(false);
  });

  it("maps Risk Areas file_refs onto diff-line markers; path-only refs stay (brief has no hunks)", () => {
    const risks: WhyRiskItem[] = [
      {
        title: "Auth bypass",
        severity: "high",
        file_refs: ["src/auth.ts:12-18", "POST /login"],
      },
      {
        title: "New cache",
        severity: "medium",
        file_refs: ["src/cache.ts:4"],
      },
      {
        title: "Docs only",
        file_refs: ["README.md"],
      },
    ];
    const map = buildRiskMarkersByPath(risks);
    expect(map.get("src/auth.ts")).toEqual([
      { line: 12, endLine: 18, severity: "high", title: "Auth bypass" },
    ]);
    expect(map.get("src/cache.ts")).toEqual([
      { line: 4, endLine: 4, severity: "medium", title: "New cache" },
    ]);
    expect(map.get("README.md")).toEqual([
      { line: 0, endLine: 0, severity: "low", title: "Docs only" },
    ]);
    expect(map.has("POST /login")).toBe(false);
  });

  it("uses review_focus line_start when the file_ref has no :line suffix", () => {
    const map = buildRiskMarkersByPath(
      [{ title: "Auth bypass", severity: "high", file_refs: ["src/auth.ts"] }],
      [{ path: "src/auth.ts", line_start: 12, line_end: 18, reason: "New helper" }],
    );
    expect(map.get("src/auth.ts")).toEqual([
      { line: 12, endLine: 18, severity: "high", title: "Auth bypass" },
    ]);
  });
});
