/**
 * Intent classifier — LLM structured output schema.
 * Aligns with shared Intent plus optional quality/missing for transport meta.
 */
import { z } from 'zod';

export const IntentClassification = z.object({
  intent: z.string(),
  in_scope: z.array(z.string()),
  out_of_scope: z.array(z.string()),
  context_quality: z.enum(['high', 'medium', 'low']).optional(),
  missing_context: z.array(z.string()).optional(),
});
export type IntentClassification = z.infer<typeof IntentClassification>;
