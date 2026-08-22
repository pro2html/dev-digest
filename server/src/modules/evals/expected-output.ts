import type { EvalExpectation } from '@devdigest/shared';

export const MAX_EXPECTED_OUTPUT_BYTES = 64 * 1024;

export type EvalTarget = {
  file: string;
  startLine: number;
  endLine: number;
};

export type ParseExpectedOk = {
  ok: true;
  expectation: EvalExpectation;
  targets: EvalTarget[];
};

export type ParseExpectedErr = {
  ok: false;
  code: 'invalid_expected_output';
  message: string;
  field: string;
};

export type ParseExpectedResult = ParseExpectedOk | ParseExpectedErr;

type RawFinding = {
  file?: unknown;
  start_line?: unknown;
  end_line?: unknown;
};

/**
 * Parse the expected-output envelope. A bare array is treated as `must_find`.
 * Unknown fields are ignored. `end_line` defaults to `start_line`.
 */
export function parseExpectedOutput(raw: unknown): ParseExpectedResult {
  if (raw === undefined || raw === null) {
    return fail('expected_output', 'Expected output is required');
  }

  const size = measureBytes(raw);
  if (size > MAX_EXPECTED_OUTPUT_BYTES) {
    return fail('expected_output', `Expected output exceeds ${MAX_EXPECTED_OUTPUT_BYTES} bytes`);
  }

  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return fail('expected_output', 'Expected output is not valid JSON');
    }
  }

  let expectation: EvalExpectation = 'must_find';
  let findings: unknown;

  if (Array.isArray(raw)) {
    findings = raw;
    expectation = 'must_find';
  } else if (raw && typeof raw === 'object') {
    const obj = raw as { expectation?: unknown; findings?: unknown };
    if (obj.expectation === 'must_find' || obj.expectation === 'must_not_flag') {
      expectation = obj.expectation;
    } else if (obj.expectation !== undefined) {
      return fail('expectation', 'expectation must be must_find or must_not_flag');
    }
    findings = obj.findings;
    if (findings === undefined) {
      return fail('findings', 'findings is required');
    }
  } else {
    return fail('expected_output', 'Expected output must be an object or an array');
  }

  if (!Array.isArray(findings)) {
    return fail('findings', 'findings must be an array');
  }

  if (expectation === 'must_find' && findings.length === 0) {
    return fail('file', 'must_find requires at least one target with file and start_line');
  }

  const targets: EvalTarget[] = [];
  for (let i = 0; i < findings.length; i++) {
    const item = findings[i] as RawFinding | null;
    if (!item || typeof item !== 'object') {
      return fail(`findings.${i}`, 'each finding must be an object');
    }
    if (typeof item.file !== 'string' || item.file.length === 0) {
      return fail(`findings.${i}.file`, 'file is required');
    }
    if (typeof item.start_line !== 'number' || !Number.isInteger(item.start_line)) {
      return fail(`findings.${i}.start_line`, 'start_line is required');
    }
    const endLine =
      typeof item.end_line === 'number' && Number.isInteger(item.end_line)
        ? item.end_line
        : item.start_line;
    targets.push({ file: item.file, startLine: item.start_line, endLine });
  }

  return { ok: true, expectation, targets };
}

function fail(field: string, message: string): ParseExpectedErr {
  return { ok: false, code: 'invalid_expected_output', message, field };
}

function measureBytes(value: unknown): number {
  if (typeof value === 'string') return value.length;
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}
