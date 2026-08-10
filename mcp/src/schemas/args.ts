import { z } from 'zod';

/** Flat arg schemas for MCP tools (no nested objects). */

export const EmptyArgs = z.object({});

export const RunAgentOnPrArgs = z.object({
  repo: z.string().uuid().describe('Repository id (UUID from GET /repos or the studio URL)'),
  pr: z.number().int().min(1).describe('Pull request number (≥ 1)'),
  agent: z.string().uuid().describe('Agent id from list_agents'),
  timeout_ms: z
    .number()
    .int()
    .min(1_000)
    .max(600_000)
    .optional()
    .describe('Max wait for the review to finish (default 300000, max 600000)'),
  max_findings: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Cap findings in the response (default 20, max 50)'),
});

export const GetFindingsArgs = z.object({
  run_id: z.string().uuid().describe('Run id returned by run_agent_on_pr'),
  max_findings: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Cap findings in the response (default 20, max 50)'),
});

export const GetConventionsArgs = z.object({
  repo: z.string().uuid().describe('Repository id (UUID from GET /repos or the studio URL)'),
  status: z
    .enum(['pending', 'accepted', 'rejected', 'all'])
    .optional()
    .describe('Filter by convention status (default accepted)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max conventions to return (default 30, max 100)'),
});

export const GetBlastRadiusArgs = z.object({
  repo: z.string().uuid().describe('Repository id (UUID from GET /repos or the studio URL)'),
  pr: z.number().int().min(1).describe('Pull request number (≥ 1)'),
});

export type RunAgentOnPrArgs = z.infer<typeof RunAgentOnPrArgs>;
export type GetFindingsArgs = z.infer<typeof GetFindingsArgs>;
export type GetConventionsArgs = z.infer<typeof GetConventionsArgs>;
export type GetBlastRadiusArgs = z.infer<typeof GetBlastRadiusArgs>;
