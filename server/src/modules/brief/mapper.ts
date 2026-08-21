/**
 * Persist mapper — stored `pr_brief.json` overlay ↔ HTTP envelope.
 * `generated_for_sha` lives inside json (no extra column / migration).
 */
import { WhyRiskBrief, WhyRiskBriefRecord } from '@devdigest/shared';
import { z } from 'zod';

export const StoredBriefJson = WhyRiskBrief.extend({
  generated_for_sha: z.string(),
});
export type StoredBrief = z.infer<typeof StoredBriefJson>;

export function emptyRecord(prId: string): WhyRiskBriefRecord {
  return {
    pr_id: prId,
    generated_for_sha: null,
    stale: false,
    brief: null,
  };
}

export function toRecord(
  prId: string,
  stored: StoredBrief,
  currentHeadSha: string,
): WhyRiskBriefRecord {
  const { generated_for_sha, ...brief } = stored;
  return {
    pr_id: prId,
    generated_for_sha,
    stale: generated_for_sha !== currentHeadSha,
    brief,
  };
}

export function fromBrief(
  brief: WhyRiskBrief,
  generatedForSha: string,
): StoredBrief {
  return { ...brief, generated_for_sha: generatedForSha };
}
