/**
 * Parse a page `limit` query/string into a bounded positive integer.
 *
 * Lab02 control experiment (Test Quality): production has empty / invalid /
 * clamp branches; the accompanying test only covers the happy path so that
 * Test Quality Reviewer + skills (`test-coverage-nudge`, `test-corner-cases`)
 * can flag the gaps — and a run without those skills is more likely to miss them.
 */

export class InvalidPageLimitError extends Error {
  constructor(raw: string) {
    super(`Invalid page limit: ${JSON.stringify(raw)}`);
    this.name = 'InvalidPageLimitError';
  }
}

/**
 * @param raw - query string value, or `undefined` when the param is omitted
 * @param fallback - default when the param is absent or empty (default 20)
 * @param max - upper clamp (default 100)
 */
export function parsePageLimit(
  raw: string | undefined,
  fallback = 20,
  max = 100,
): number {
  if (raw == null || raw.trim() === '') {
    return fallback;
  }

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new InvalidPageLimitError(raw);
  }

  return Math.min(Math.floor(n), max);
}
