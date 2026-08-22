import { describe, expect, it } from 'vitest';
import { normalizeEvalPath } from '../src/modules/evals/paths.js';

describe('normalizeEvalPath', () => {
  it('strips a/ b/ and ./ prefixes and uses POSIX slashes (AC-25)', () => {
    expect(normalizeEvalPath('a/src/config.ts')).toBe('src/config.ts');
    expect(normalizeEvalPath('b/src/config.ts')).toBe('src/config.ts');
    expect(normalizeEvalPath('./src/config.ts')).toBe('src/config.ts');
    expect(normalizeEvalPath('src\\config.ts')).toBe('src/config.ts');
  });

  it('compares case-sensitively (AC-25)', () => {
    expect(normalizeEvalPath('src/Config.ts')).toBe('src/Config.ts');
    expect(normalizeEvalPath('src/config.ts')).toBe('src/config.ts');
    expect(normalizeEvalPath('src/Config.ts')).not.toBe(normalizeEvalPath('src/config.ts'));
  });

  it('rejects path traversal and absolute roots (AC-25)', () => {
    expect(normalizeEvalPath('../etc/passwd')).toBeNull();
    expect(normalizeEvalPath('src/../../secret')).toBeNull();
    expect(normalizeEvalPath('/etc/passwd')).toBeNull();
    expect(normalizeEvalPath('C:/Windows/system32')).toBeNull();
    expect(normalizeEvalPath('src/\0evil')).toBeNull();
    expect(normalizeEvalPath('')).toBeNull();
  });
});
