import type { EvalCaseDraft, EvalExpectation } from "@devdigest/shared";

export type InputTab = "diff" | "files" | "prMeta";

export function parseMeta(raw: unknown): { title: string; body: string } {
  if (!raw || typeof raw !== "object") return { title: "", body: "" };
  const m = raw as { title?: unknown; body?: unknown };
  return {
    title: typeof m.title === "string" ? m.title : "",
    body: typeof m.body === "string" ? m.body : "",
  };
}

export function parseFilePaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const paths: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) paths.push(item.trim());
    else if (item && typeof item === "object" && typeof (item as { path?: unknown }).path === "string") {
      const p = (item as { path: string }).path.trim();
      if (p) paths.push(p);
    }
  }
  return paths;
}

export function filesPayload(paths: string[]): { path: string }[] | null {
  const cleaned = paths.map((p) => p.trim()).filter(Boolean);
  return cleaned.length ? cleaned.map((path) => ({ path })) : null;
}

export function stringifyExpected(raw: unknown): string {
  if (raw == null) {
    return JSON.stringify([SKELETON], null, 2);
  }
  try {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const obj = raw as { expectation?: unknown; findings?: unknown };
      if (obj.expectation === "must_find" && Array.isArray(obj.findings)) {
        return JSON.stringify(obj.findings, null, 2);
      }
    }
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

export function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export const FINDING_SKELETON = {
  severity: "CRITICAL",
  category: "security",
  title: "",
  file: "",
  start_line: 1,
};

const SKELETON = FINDING_SKELETON;

/** Insert a finding skeleton into envelope-or-array expected JSON. */
export function insertFindingSkeleton(text: string): string {
  const parsed = parseJson(text);
  if (!parsed.ok) return JSON.stringify([SKELETON], null, 2);
  const value = parsed.value;
  if (Array.isArray(value)) return JSON.stringify([...value, SKELETON], null, 2);
  if (value && typeof value === "object") {
    const obj = value as { findings?: unknown };
    const findings = Array.isArray(obj.findings) ? obj.findings : [];
    return JSON.stringify({ ...obj, findings: [...findings, SKELETON] }, null, 2);
  }
  return JSON.stringify([SKELETON], null, 2);
}

export function expectationFromJson(text: string, fallback: EvalExpectation): EvalExpectation {
  const parsed = parseJson(text);
  if (!parsed.ok) return fallback;
  if (Array.isArray(parsed.value)) return "must_find";
  if (parsed.value && typeof parsed.value === "object") {
    const exp = (parsed.value as { expectation?: unknown }).expectation;
    if (exp === "must_find" || exp === "must_not_flag") return exp;
  }
  return fallback;
}

export function firstFinding(
  raw: unknown,
): { title?: unknown; file?: unknown; start_line?: unknown; severity?: unknown; category?: unknown } | undefined {
  const findings = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? (raw as { findings?: unknown }).findings
      : null;
  if (!Array.isArray(findings) || findings.length === 0) return undefined;
  return findings[0] as { title?: unknown; file?: unknown; start_line?: unknown; severity?: unknown; category?: unknown };
}

export function firstFindingTitle(raw: unknown): string | undefined {
  const f = firstFinding(raw);
  return typeof f?.title === "string" ? f.title : undefined;
}

export function firstFindingFile(raw: unknown): string | undefined {
  const f = firstFinding(raw);
  return typeof f?.file === "string" ? f.file : undefined;
}

export function firstFindingLine(raw: unknown): number | undefined {
  const line = firstFinding(raw)?.start_line;
  return typeof line === "number" ? line : undefined;
}

export type DiffLine = { kind: "add" | "del" | "ctx" | "hunk" | "file"; text: string };

export function previewDiffLines(diff: string): DiffLine[] {
  if (!diff.trim()) return [];
  const out: DiffLine[] = [];
  for (const raw of diff.split("\n")) {
    if (
      raw.startsWith("diff ") ||
      raw.startsWith("index ") ||
      raw.startsWith("--- ") ||
      raw.startsWith("+++ ")
    ) {
      out.push({ kind: "file", text: raw });
    } else if (raw.startsWith("@@")) {
      out.push({ kind: "hunk", text: raw });
    } else if (raw.startsWith("+")) {
      out.push({ kind: "add", text: raw });
    } else if (raw.startsWith("-")) {
      out.push({ kind: "del", text: raw });
    } else {
      out.push({ kind: "ctx", text: raw });
    }
  }
  return out;
}

export function seedToInitial(seed: EvalCaseDraft): {
  name: string;
  diff: string;
  files: string[];
  title: string;
  body: string;
  expected: string;
  expectation: EvalExpectation;
} {
  const meta = parseMeta(seed.input_meta);
  return {
    name: seed.name,
    diff: seed.input_diff,
    files: parseFilePaths(seed.input_files),
    title: meta.title,
    body: meta.body,
    expected: stringifyExpected(seed.expected_output),
    expectation: seed.expectation,
  };
}
