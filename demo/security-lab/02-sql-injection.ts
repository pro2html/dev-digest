/**
 * Demo fixture — SQL built from request input (OWASP A03).
 * Intended to be flagged by Security Reviewer every time.
 */
export async function findUserByEmail(
  db: { query: (sql: string) => Promise<unknown> },
  email: string,
): Promise<unknown> {
  return db.query(`SELECT * FROM users WHERE email = '${email}' AND deleted_at IS NULL`);
}
