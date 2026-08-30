/**
 * Local HTTP DTOs for multi-agent reads. Not in @devdigest/shared —
 * same idea as reviews/summary-dto.ts.
 */
import { z } from 'zod';
import { Conflict, MultiAgentRun } from '@devdigest/shared';

export const MultiAgentGetEnvelope = z.object({
  pr_id: z.string(),
  run: MultiAgentRun.nullable(),
  /** Every file+line grouping (agreements included). Filter in the UI. */
  grouped_locations: z.array(Conflict),
});
export type MultiAgentGetEnvelope = z.infer<typeof MultiAgentGetEnvelope>;

export const AgentReviewEstimate = z.object({
  agent_id: z.string(),
  estimate_duration_ms: z.number().int().nullable(),
  estimate_cost_usd: z.number().nullable(),
});
export type AgentReviewEstimate = z.infer<typeof AgentReviewEstimate>;

export const AgentReviewEstimates = z.array(AgentReviewEstimate);
export type AgentReviewEstimates = z.infer<typeof AgentReviewEstimates>;

export const MultiAgentListEnvelope = z.object({
  pr_id: z.string(),
  runs: z.array(MultiAgentRun),
});
export type MultiAgentListEnvelope = z.infer<typeof MultiAgentListEnvelope>;
