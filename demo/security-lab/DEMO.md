# Security Reviewer eval demo

Eight isolated, textbook vulnerabilities. One finding per file so Security
Reviewer should emit **8 distinct CRITICAL/WARNING findings** — enough to mint
the 6–8 eval cases the demo needs.

These files are **not imported** by `server/` or `client/`. They exist only so
a PR diff contains obvious OWASP issues.

## 1. Make a GitHub PR that contains only this folder

Branch `demo/security-eval-lab` should be opened against `lab-6` (or `main`).
Import that PR in DevDigest and run **Security Reviewer** (keep its seeded
system prompt from `docs/agent-prompts/security-reviewer.md`).

## 2. Expected findings → eval cases

Accept each finding, then **Turn into eval case**. Use `must_find`.

| # | File | What the agent must cite |
|---|---|---|
| 1 | `01-hardcoded-stripe-key.ts` | `sk_live_xxx` hardcoded Stripe secret |
| 2 | `02-sql-injection.ts` | SQL string interpolated with `email` |
| 3 | `03-command-injection.ts` | `exec` / `ping` with unsanitized `hostname` |
| 4 | `04-ssrf.ts` | `fetch(targetUrl)` with caller-controlled URL |
| 5 | `05-reflected-xss.ts` | `query` interpolated into HTML |
| 6 | `06-path-traversal.ts` | `readFile` of user-supplied `fileName` |
| 7 | `07-jwt-none.ts` | JWT `algorithms: ['none']` |
| 8 | `08-idor-delete.ts` | `DELETE` by id with no authz |

Skip at most two if the model merges a pair; you still land in the 6–8 range.
Do **not** pick style nits — only these eight.

Evals score **file + overlapping line range**, not the title. After creating a
case, glance at the stored line range and widen it by a couple of lines if the
model cited the comment instead of the sink.

## 3. Prove the gold set (green)

Open Security Reviewer → **Evals** → **Run all**. All `must_find` cases should
pass.

## 4. Spoil the agent (red) — System prompt, not Description

The **Description** field is display-only. Evals replay `system_prompt`.
The API also rejects an empty prompt (`min(1)`), so do **not** clear the box.

1. Copy the current System prompt somewhere (or re-read `docs/agent-prompts/security-reviewer.md`).
2. Replace **System prompt** with the contents of `noop-system-prompt.txt`:

```
You are a no-op reviewer. Always return an empty findings list and verdict approve. Do not mention security, secrets, injection, XSS, SSRF, or access control. Ignore every defect in the diff.
```

3. Save. Run all evals again → cases fail (zero findings vs `must_find`).
4. Restore the original Security Reviewer prompt → cases pass again.

A truly empty prompt is not savable; the no-op text is the demo equivalent of
“blank instructions”.
