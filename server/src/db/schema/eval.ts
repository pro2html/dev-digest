import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  doublePrecision,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { now } from './_shared';
import { workspaces } from './core';
import { pullRequests } from './pulls';

// ============================================================ Eval / Conformance / Compose

export const evalCases = pgTable(
  'eval_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ownerKind: text('owner_kind', { enum: ['skill', 'agent'] }).notNull(),
    ownerId: uuid('owner_id').notNull(),
    name: text('name').notNull(),
    inputDiff: text('input_diff'),
    inputFiles: jsonb('input_files'),
    inputMeta: jsonb('input_meta'),
    expectedOutput: jsonb('expected_output'),
    notes: text('notes'),
    inputRevision: integer('input_revision').notNull().default(1),
    sourceFindingId: uuid('source_finding_id'),
    createdAt: now(),
  },
  (t) => ({
    ownerIdx: index('eval_cases_owner_idx').on(t.workspaceId, t.ownerKind, t.ownerId),
    sourceFindingUq: uniqueIndex('eval_cases_ws_source_finding_uq').on(
      t.workspaceId,
      t.sourceFindingId,
    ),
  }),
);

export const evalSetRuns = pgTable(
  'eval_set_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ownerKind: text('owner_kind', { enum: ['skill', 'agent'] }).notNull(),
    ownerId: uuid('owner_id').notNull(),
    ownerVersion: integer('owner_version').notNull(),
    systemPrompt: text('system_prompt').notNull(),
    baselineLabel: text('baseline_label'),
    status: text('status', {
      enum: ['queued', 'running', 'complete', 'partial', 'cancelled', 'failed'],
    }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    casesTotal: integer('cases_total').notNull().default(0),
    casesFinished: integer('cases_finished').notNull().default(0),
    passed: integer('passed'),
    recall: doublePrecision('recall'),
    precision: doublePrecision('precision'),
    citationAccuracy: doublePrecision('citation_accuracy'),
    recallNotApplicable: boolean('recall_not_applicable'),
    precisionNotApplicable: boolean('precision_not_applicable'),
    citationAccuracyNotApplicable: boolean('citation_accuracy_not_applicable'),
    costUsd: doublePrecision('cost_usd'),
    durationMs: integer('duration_ms'),
  },
  (t) => ({
    historyIdx: index('eval_set_runs_owner_started_idx').on(
      t.workspaceId,
      t.ownerKind,
      t.ownerId,
      t.startedAt,
    ),
  }),
);

export const evalRuns = pgTable(
  'eval_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => evalCases.id, { onDelete: 'cascade' }),
    ranAt: timestamp('ran_at', { withTimezone: true }).defaultNow().notNull(),
    actualOutput: jsonb('actual_output'),
    pass: boolean('pass'),
    recall: doublePrecision('recall'),
    precision: doublePrecision('precision'),
    citationAccuracy: doublePrecision('citation_accuracy'),
    durationMs: integer('duration_ms'),
    costUsd: doublePrecision('cost_usd'),
    setRunId: uuid('set_run_id').references(() => evalSetRuns.id, { onDelete: 'cascade' }),
    result: text('result', { enum: ['passed', 'failed', 'errored'] }),
    error: text('error'),
    caseInputRevision: integer('case_input_revision'),
  },
  (t) => ({
    setRunIdx: index('eval_runs_set_run_idx').on(t.setRunId),
  }),
);

export const conformanceChecks = pgTable('conformance_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  prId: uuid('pr_id')
    .notNull()
    .references(() => pullRequests.id, { onDelete: 'cascade' }),
  specId: text('spec_id').notNull(),
  completenessPct: doublePrecision('completeness_pct'),
  items: jsonb('items'),
});

export const composedReviews = pgTable('composed_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  prId: uuid('pr_id')
    .notNull()
    .references(() => pullRequests.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  verdict: text('verdict'),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  githubReviewId: text('github_review_id'),
});
