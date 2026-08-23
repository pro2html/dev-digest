/**
 * Demo fixture — JWT verified with algorithm "none" (OWASP A07).
 * Intended to be flagged by Security Reviewer every time.
 */
type JwtLib = {
  verify: (token: string, secret: string, opts: { algorithms: string[] }) => unknown;
};

export function decodeSession(jwt: JwtLib, token: string): unknown {
  return jwt.verify(token, '', { algorithms: ['none'] });
}
