import { and, eq } from 'drizzle-orm';
import type { Db } from './client.js';
import * as t from './schema.js';

export const TEST_COVERAGE_NUDGE_SKILL = 'test-coverage-nudge';

type ExpectedFinding = {
  file: string;
  start_line: number;
  end_line: number;
  severity?: string;
  category?: string;
  title?: string;
};

export type SeedEvalCase = {
  name: string;
  inputDiff: string;
  inputFiles: { path: string }[];
  inputMeta: { title: string; body: string };
  expectedOutput: {
    expectation: 'must_find' | 'must_not_flag';
    findings: ExpectedFinding[];
  };
  notes: string;
};

/** Frozen skill-owned cases for `test-coverage-nudge`. Both expectation types, five cases. */
export const COVERAGE_NUDGE_EVAL_CASES: SeedEvalCase[] = [
  {
    name: 'must-find-untested-min-branch',
    inputDiff: `diff --git a/src/billing/parse-limit.ts b/src/billing/parse-limit.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/billing/parse-limit.ts
@@ -0,0 +1,8 @@
+export function parseLimit(raw: string): number {
+  const n = Number(raw);
+  if (!Number.isFinite(n)) throw new Error('invalid');
+  if (n < 1) {
+    throw new Error('below minimum');
+  }
+  return n;
+}
`,
    inputFiles: [{ path: 'src/billing/parse-limit.ts' }],
    inputMeta: {
      title: 'Parse billing limits from query strings',
      body: 'Adds parseLimit. No test file in this PR.',
    },
    expectedOutput: {
      expectation: 'must_find',
      findings: [
        {
          file: 'src/billing/parse-limit.ts',
          start_line: 4,
          end_line: 6,
          severity: 'WARNING',
          category: 'testing',
          title: '[COVERAGE] n<1 throw path untested — only finite-number parse covered',
        },
      ],
    },
    notes: 'New if (n < 1) branch with no tests in the diff. Skill must flag it.',
  },
  {
    name: 'must-find-untested-else-refund',
    inputDiff: `diff --git a/src/billing/refund.ts b/src/billing/refund.ts
index 1111111..2222222 100644
--- a/src/billing/refund.ts
+++ b/src/billing/refund.ts
@@ -1,3 +1,7 @@
 export function refundable(status: string): boolean {
-  return status === 'paid';
+  if (status === 'paid') {
+    return true;
+  } else {
+    return false;
+  }
 }
diff --git a/src/billing/refund.test.ts b/src/billing/refund.test.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/billing/refund.test.ts
@@ -0,0 +1,5 @@
+import { refundable } from './refund';
+
+it('paid is refundable', () => {
+  expect(refundable('paid')).toBe(true);
+});
`,
    inputFiles: [{ path: 'src/billing/refund.ts' }, { path: 'src/billing/refund.test.ts' }],
    inputMeta: {
      title: 'Split refundable into explicit branches',
      body: 'Happy-path test only covers status === paid.',
    },
    expectedOutput: {
      expectation: 'must_find',
      findings: [
        {
          file: 'src/billing/refund.ts',
          start_line: 4,
          end_line: 6,
          severity: 'WARNING',
          category: 'testing',
          title: '[COVERAGE] else path for non-paid status untested',
        },
      ],
    },
    notes: 'else branch is new production control flow; the suite never enters it.',
  },
  {
    name: 'must-not-flag-catch-tested',
    inputDiff: `diff --git a/src/http/fetch-json.ts b/src/http/fetch-json.ts
index 1111111..2222222 100644
--- a/src/http/fetch-json.ts
+++ b/src/http/fetch-json.ts
@@ -1,4 +1,8 @@
 export async function fetchJson(url: string) {
-  const res = await fetch(url);
-  return res.json();
+  try {
+    const res = await fetch(url);
+    return await res.json();
+  } catch (err) {
+    throw new Error('fetch failed');
+  }
 }
diff --git a/src/http/fetch-json.test.ts b/src/http/fetch-json.test.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/http/fetch-json.test.ts
@@ -0,0 +1,13 @@
+import { fetchJson } from './fetch-json';
+
+it('returns parsed json', async () => {
+  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }));
+  await expect(fetchJson('/x')).resolves.toEqual({ ok: true });
+});
+
+it('wraps a rejected fetch', async () => {
+  globalThis.fetch = async () => {
+    throw new Error('network');
+  };
+  await expect(fetchJson('/x')).rejects.toThrow('fetch failed');
+});
`,
    inputFiles: [{ path: 'src/http/fetch-json.ts' }, { path: 'src/http/fetch-json.test.ts' }],
    inputMeta: {
      title: 'Wrap fetchJson in try/catch with rejection coverage',
      body: 'Catch path is asserted with a rejected fetch.',
    },
    expectedOutput: { expectation: 'must_not_flag', findings: [] },
    notes: 'New catch is exercised by a behavioural rejection test. Coverage skill should stay quiet.',
  },
  {
    name: 'must-not-flag-empty-list-covered',
    inputDiff: `diff --git a/src/orders/summarize.ts b/src/orders/summarize.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/orders/summarize.ts
@@ -0,0 +1,6 @@
+export function summarize(items: { total: number }[]): number {
+  if (items.length === 0) {
+    return 0;
+  }
+  return items.reduce((sum, item) => sum + item.total, 0);
+}
diff --git a/src/orders/summarize.test.ts b/src/orders/summarize.test.ts
new file mode 100644
index 0000000..2222222
--- /dev/null
+++ b/src/orders/summarize.test.ts
@@ -0,0 +1,9 @@
+import { summarize } from './summarize';
+
+it('empty items returns 0', () => {
+  expect(summarize([])).toBe(0);
+});
+
+it('sums totals', () => {
+  expect(summarize([{ total: 2 }, { total: 3 }])).toBe(5);
+});
`,
    inputFiles: [{ path: 'src/orders/summarize.ts' }, { path: 'src/orders/summarize.test.ts' }],
    inputMeta: {
      title: 'Summarize order totals including the empty list',
      body: 'Early return is asserted with summarize([]).',
    },
    expectedOutput: { expectation: 'must_not_flag', findings: [] },
    notes: 'Empty-list early return has a behavioural test. Coverage skill should stay quiet.',
  },
  {
    name: 'must-find-untested-switch-failed-branch',
    inputDiff: `diff --git a/src/webhooks/status.ts b/src/webhooks/status.ts
index 1111111..2222222 100644
--- a/src/webhooks/status.ts
+++ b/src/webhooks/status.ts
@@ -1,3 +1,12 @@
 export function mapStatus(event: string): string {
-  return event;
+  switch (event) {
+    case 'charge.succeeded':
+      return 'paid';
+    case 'charge.failed':
+      return 'failed';
+    case 'charge.refunded':
+      return 'refunded';
+    default:
+      return 'unknown';
+  }
 }
diff --git a/src/webhooks/status.test.ts b/src/webhooks/status.test.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/webhooks/status.test.ts
@@ -0,0 +1,5 @@
+import { mapStatus } from './status';
+
+it('maps succeeded', () => {
+  expect(mapStatus('charge.succeeded')).toBe('paid');
+});
`,
    inputFiles: [{ path: 'src/webhooks/status.ts' }, { path: 'src/webhooks/status.test.ts' }],
    inputMeta: {
      title: 'Map Stripe charge events to order status',
      body: 'Suite only hits charge.succeeded.',
    },
    expectedOutput: {
      expectation: 'must_find',
      findings: [
        {
          file: 'src/webhooks/status.ts',
          start_line: 5,
          end_line: 6,
          severity: 'WARNING',
          category: 'testing',
          title: '[COVERAGE] charge.failed switch arm untested — only succeeded covered',
        },
      ],
    },
    notes: 'Happy-path-only suite against a new switch. Name the uncovered failed arm.',
  },
];

export async function seedCoverageNudgeEvalCases(db: Db, workspaceId: string): Promise<void> {
  const [skill] = await db
    .select()
    .from(t.skills)
    .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, TEST_COVERAGE_NUDGE_SKILL)));
  if (!skill) return;

  for (const c of COVERAGE_NUDGE_EVAL_CASES) {
    const [existing] = await db
      .select({ id: t.evalCases.id })
      .from(t.evalCases)
      .where(
        and(
          eq(t.evalCases.workspaceId, workspaceId),
          eq(t.evalCases.ownerKind, 'skill'),
          eq(t.evalCases.ownerId, skill.id),
          eq(t.evalCases.name, c.name),
        ),
      );
    if (!existing) {
      await db.insert(t.evalCases).values({
        workspaceId,
        ownerKind: 'skill',
        ownerId: skill.id,
        name: c.name,
        inputDiff: c.inputDiff,
        inputFiles: c.inputFiles,
        inputMeta: c.inputMeta,
        expectedOutput: c.expectedOutput,
        notes: c.notes,
        inputRevision: 1,
      });
      continue;
    }
    await db
      .update(t.evalCases)
      .set({
        inputDiff: c.inputDiff,
        inputFiles: c.inputFiles,
        inputMeta: c.inputMeta,
        expectedOutput: c.expectedOutput,
        notes: c.notes,
      })
      .where(eq(t.evalCases.id, existing.id));
  }
}
