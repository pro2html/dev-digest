import type { LogLine } from "@devdigest/ui";
import type { RunTrace } from "@devdigest/shared";

interface RawEvent {
  t: string;
  kind: string;
  msg: string;
}

/** Map run-bus events to the LiveLogStream LogLine shape. */
export function eventsToLog(events: RawEvent[]): LogLine[] {
  return events.map((e) => ({ t: e.t, k: e.kind as LogLine["k"], m: e.msg }));
}

/** Map a persisted trace's log to the LiveLogStream LogLine shape. */
export function traceLog(trace: RunTrace | undefined): LogLine[] {
  return trace?.log.map((l) => ({ t: l.t, k: l.kind as LogLine["k"], m: l.msg })) ?? [];
}

/** Seconds-formatted duration. */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Token in→out summary (e.g. "12k→1.5k"). */
export function formatTokens(tokensIn: number, tokensOut: number): string {
  return `${(tokensIn / 1000).toFixed(0)}k→${(tokensOut / 1000).toFixed(1)}k`;
}

/** Split persisted `prompt_assembly.specs` into per-path bodies (### path headers). */
export function parseInjectedSpecs(
  specsText: string | null | undefined,
  paths: readonly string[],
): { path: string; content: string }[] {
  const text = specsText ?? "";
  return paths.map((path) => {
    const heading = `### ${path}\n`;
    const start = text.indexOf(heading);
    if (start < 0) return { path, content: "" };
    const bodyStart = start + heading.length;
    const endTag = text.indexOf("</untrusted>", bodyStart);
    const raw = (endTag >= 0 ? text.slice(bodyStart, endTag) : text.slice(bodyStart)).replace(
      /\s+$/,
      "",
    );
    return { path, content: raw };
  });
}
