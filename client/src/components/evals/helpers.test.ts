import { describe, it, expect } from "vitest";
import {
  displayExpectedCount,
  expectationFromJson,
  firstFindingEndLine,
  firstFindingLine,
  isEvalCaseBusy,
  lineRangeLabel,
  seedOverridesExisting,
  stringifyExpected,
  wrapExpectedOutput,
} from "./helpers";

describe("lineRangeLabel", () => {
  it("keeps a single line as a number-like string", () => {
    expect(lineRangeLabel(11)).toBe("11");
    expect(lineRangeLabel(11, 11)).toBe("11");
  });

  it("formats a range as start-end", () => {
    expect(lineRangeLabel(2, 15)).toBe("2-15");
  });
});

describe("firstFinding line helpers", () => {
  it("reads start_line and end_line from expected output", () => {
    const raw = { expectation: "must_find", findings: [{ file: "a.ts", start_line: 2, end_line: 15 }] };
    expect(firstFindingLine(raw)).toBe(2);
    expect(firstFindingEndLine(raw)).toBe(15);
  });
});

describe("seedOverridesExisting", () => {
  it("is true when the stored case expectation no longer matches the finding seed", () => {
    expect(seedOverridesExisting({ expectation: "must_find" }, { expectation: "must_not_flag" })).toBe(true);
    expect(seedOverridesExisting({ expectation: "must_find" }, { expectation: "must_find" })).toBe(false);
  });

  it("is true when a dismissed seed still has leftover must_find targets", () => {
    expect(
      seedOverridesExisting({ expectation: "must_not_flag", expected_count: 1 }, { expectation: "must_not_flag" }),
    ).toBe(true);
  });
});

describe("displayExpectedCount", () => {
  it("shows 0 for must_not_flag even when leftover targets are stored", () => {
    expect(displayExpectedCount("must_not_flag", 1)).toBe(0);
    expect(displayExpectedCount("must_not_flag", 0)).toBe(0);
    expect(displayExpectedCount("must_find", 1)).toBe(1);
  });
});

describe("expectationFromJson", () => {
  it("treats an empty array as must_not_flag", () => {
    expect(expectationFromJson("[]", "must_find")).toBe("must_not_flag");
    expect(expectationFromJson("[{}]", "must_not_flag")).toBe("must_find");
  });
});

describe("stringifyExpected / wrapExpectedOutput", () => {
  it("shows a dismissed seed as [] and wraps it back to an envelope on persist", () => {
    expect(stringifyExpected({ expectation: "must_not_flag", findings: [] })).toBe("[]");
    expect(wrapExpectedOutput([], "must_not_flag")).toEqual({ expectation: "must_not_flag", findings: [] });
  });
});

describe("isEvalCaseBusy", () => {
  it("marks only the case whose single run is in flight", () => {
    expect(isEvalCaseBusy({ caseId: "a", runningCaseId: "a", setRunActive: false, finishedCaseIds: [] })).toBe(true);
    expect(isEvalCaseBusy({ caseId: "b", runningCaseId: "a", setRunActive: false, finishedCaseIds: [] })).toBe(false);
  });

  it("marks every unfinished case while a whole-set run is active", () => {
    expect(isEvalCaseBusy({ caseId: "a", setRunActive: true, finishedCaseIds: ["a"] })).toBe(false);
    expect(isEvalCaseBusy({ caseId: "b", setRunActive: true, finishedCaseIds: ["a"] })).toBe(true);
    expect(isEvalCaseBusy({ caseId: "a", setRunActive: true, finishedCaseIds: [] })).toBe(true);
  });
});
