import { describe, expect, it } from 'vitest';
import { parsePageLimit } from '../src/modules/_shared/parse-page-limit.js';

/**
 * Lab02 — intentionally happy-path-only.
 * Missing: empty/undefined → fallback, non-numeric / <1 → throw, n > max → clamp.
 */
describe('parsePageLimit', () => {
  it('parses a valid limit', () => {
    expect(parsePageLimit('10')).toBe(10);
  });
});
