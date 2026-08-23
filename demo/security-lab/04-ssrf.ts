/**
 * Demo fixture — server-side fetch of a caller-controlled URL (OWASP A10).
 * Intended to be flagged by Security Reviewer every time.
 */
export async function previewLink(targetUrl: string): Promise<string> {
  const res = await fetch(targetUrl);
  return res.text();
}
