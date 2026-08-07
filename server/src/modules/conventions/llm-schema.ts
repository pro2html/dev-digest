/**
 * Conventions Extractor — LLM structured output schema.
 *
 * Internal prompt contract (not client-facing). Kept flat and permissive
 * to avoid strict json_schema mode rejections.
 */
import { z } from 'zod';
import { ConventionCategory } from '@devdigest/shared';
import { MAX_CANDIDATES } from './constants.js';

export const ConventionsExtraction = z.object({
  candidates: z.array(
    z.object({
      category: ConventionCategory,
      rule: z.string(),
      applies_to: z.string().nullable(),
      evidence: z.object({
        path: z.string(),
        line: z.number().int(),
        snippet: z.string(),
      }),
      also_seen_in: z.array(z.string()),
      confidence: z.number(),
    }),
  ).max(MAX_CANDIDATES),
});
export type ConventionsExtraction = z.infer<typeof ConventionsExtraction>;
