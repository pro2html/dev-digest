/**
 * Demo fixture — shell exec of unsanitized user input (OWASP A03).
 * Intended to be flagged by Security Reviewer every time.
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function pingHost(hostname: string): Promise<string> {
  const { stdout } = await execAsync(`ping -c 1 ${hostname}`);
  return stdout;
}
