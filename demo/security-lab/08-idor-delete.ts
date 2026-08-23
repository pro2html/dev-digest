/**
 * Demo fixture — delete-by-id with no authn/authz check (OWASP A01 IDOR).
 * Intended to be flagged by Security Reviewer every time.
 */
export async function deleteAccount(
  db: { execute: (sql: string, params: unknown[]) => Promise<void> },
  accountId: string,
): Promise<void> {
  await db.execute('DELETE FROM accounts WHERE id = $1', [accountId]);
}
