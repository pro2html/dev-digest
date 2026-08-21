/**
 * Why+Risk Brief writer — LLM structured output schema.
 *
 * Optional fields are `.nullable()` so OpenAI strict json_schema still lists
 * them. HTTP envelope uses `.optional()` instead (see WhyRiskBrief).
 */
import { z } from 'zod';
import { RiskSeverity } from '@devdigest/shared';

export const WhyRiskLlmRisk = z.object({
  title: z.string(),
  explanation: z.string().nullable(),
  severity: RiskSeverity.nullable(),
  file_refs: z.array(z.string()),
});

export const WhyRiskLlmFocus = z.object({
  path: z.string(),
  line_start: z.number().int().nullable(),
  line_end: z.number().int().nullable(),
  reason: z.string(),
});

export const WhyRiskLlmOutput = z.object({
  what: z.string(),
  why: z.string(),
  risk_level: RiskSeverity,
  risks: z.array(WhyRiskLlmRisk),
  review_focus: z.array(WhyRiskLlmFocus),
});
export type WhyRiskLlmOutput = z.infer<typeof WhyRiskLlmOutput>;
export type WhyRiskLlmRisk = z.infer<typeof WhyRiskLlmRisk>;
export type WhyRiskLlmFocus = z.infer<typeof WhyRiskLlmFocus>;
