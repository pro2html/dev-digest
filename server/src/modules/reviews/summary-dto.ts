/**
 * Local DTO for GET /runs/:id/summary — MCP / compact clients.
 * Intentionally NOT in @devdigest/shared (MVP: no vendor/shared edits).
 */
import { z } from 'zod';

export const RunSummaryFindingDto = z.object({
  id: z.string().uuid(),
  severity: z.string(),
  category: z.string(),
  title: z.string(),
  file: z.string(),
  start_line: z.number().int(),
  end_line: z.number().int(),
  rationale: z.string().nullable().optional(),
  suggestion: z.string().nullable().optional(),
});

export const RunSummaryDto = z.object({
  run_id: z.string().uuid(),
  agent_id: z.string().uuid().nullable(),
  agent_name: z.string().nullable(),
  status: z.string(),
  verdict: z.string().nullable(),
  score: z.number().int().nullable(),
  summary: z.string().nullable(),
  findings: z.array(RunSummaryFindingDto),
  error: z.string().nullable().optional(),
});

export type RunSummaryDto = z.infer<typeof RunSummaryDto>;
export type RunSummaryFindingDto = z.infer<typeof RunSummaryFindingDto>;
