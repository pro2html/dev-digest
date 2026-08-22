import * as t from '../../db/schema.js';

export type EvalCaseRow = typeof t.evalCases.$inferSelect;
export type EvalRunRow = typeof t.evalRuns.$inferSelect;
export type EvalSetRunRow = typeof t.evalSetRuns.$inferSelect;
