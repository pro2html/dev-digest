import { pgTable, uuid, text, integer, primaryKey, index } from 'drizzle-orm/pg-core';
import { agents } from './agents';
import { skills } from './skills';

/** Ordered markdown paths attached to an agent (workspace-level; resolved per-run against the PR repo clone). */
export const agentContextDocs = pgTable(
  'agent_context_docs',
  {
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    order: integer('order').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.agentId, t.path] }),
    pathIdx: index('agent_context_docs_path_idx').on(t.path),
  }),
);

/** Ordered markdown paths attached to a skill; inherited by agents with the skill enabled+linked. */
export const skillContextDocs = pgTable(
  'skill_context_docs',
  {
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    order: integer('order').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.skillId, t.path] }),
    pathIdx: index('skill_context_docs_path_idx').on(t.path),
  }),
);
