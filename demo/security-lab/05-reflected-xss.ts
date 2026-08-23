/**
 * Demo fixture — unescaped query string written into HTML (XSS).
 * Intended to be flagged by Security Reviewer every time.
 */
export function searchPage(query: string): string {
  return `<!doctype html><h1>Results for ${query}</h1>`;
}
