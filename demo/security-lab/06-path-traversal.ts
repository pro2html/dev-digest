/**
 * Demo fixture — user path concatenated onto a file read (OWASP A01).
 * Intended to be flagged by Security Reviewer every time.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const EXPORTS_DIR = '/var/app/exports';

export async function readExport(fileName: string): Promise<string> {
  return readFile(path.join(EXPORTS_DIR, fileName), 'utf8');
}
