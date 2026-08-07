import { pgTable, uuid, text, jsonb, timestamp, doublePrecision, boolean, vector, index, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { now } from './_shared';
import { workspaces } from './core';
import { repos } from './repos';
import { skills } from './skills';

// ============================================================ Knowledge / RAG

export const memory = pgTable(
  'memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoId: uuid('repo_id').references(() => repos.id, { onDelete: 'cascade' }),
    scope: text('scope', { enum: ['repo', 'global', 'team'] }).notNull(),
    kind: text('kind', {
      enum: ['decision', 'convention', 'preference', 'fact', 'learning'],
    }).notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    confidence: doublePrecision('confidence'),
    sources: jsonb('sources'),
    createdAt: now(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => ({ wsIdx: index('memory_ws_idx').on(t.workspaceId) }),
);

export const conventions = pgTable(
  'conventions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoId: uuid('repo_id').references(() => repos.id, { onDelete: 'cascade' }),
    rule: text('rule').notNull(),
    ruleHash: text('rule_hash').notNull(),
    category: text('category', {
      enum: ['naming', 'error_handling', 'async', 'structure', 'imports', 'api_contract', 'testing', 'logging', 'types', 'other'],
    }).notNull().default('other'),
    appliesTo: text('applies_to'),
    evidencePath: text('evidence_path'),
    evidenceLine: integer('evidence_line'),
    evidenceSnippet: text('evidence_snippet'),
    confidence: doublePrecision('confidence'),
    status: text('status', { enum: ['pending', 'accepted', 'rejected'] }).notNull().default('pending'),
    supportCount: integer('support_count'),
    violationCount: integer('violation_count'),
    edited: boolean('edited').notNull().default(false),
    skillId: uuid('skill_id').references(() => skills.id, { onDelete: 'set null' }),
    accepted: boolean('accepted').notNull().default(false),
    createdAt: now(),
  },
  (t) => ({
    repoStatusIdx: index('conventions_repo_status_idx').on(t.repoId, t.status),
    repoRuleUq: uniqueIndex('conventions_repo_rule_uq').on(t.repoId, t.ruleHash),
  }),
);
