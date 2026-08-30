/**
 * Server-local Zod DTOs for the CI HTTP surface.
 * Intentionally NOT in vendor/shared — list projections and zip/open-PR extras.
 */
import { z } from 'zod';
import {
  CiExport,
  CiExportInput,
  CiFile,
  CiInstallation,
  CiResultArtifact,
  CiRunStatus,
  CiTarget,
} from '@devdigest/shared';

export const RepoField = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'repo must be owner/name');

export const CiPreviewBody = CiExportInput.omit({ action: true }).extend({
  repo: RepoField,
  workflow_override: z.string().max(200_000).optional(),
});
export type CiPreviewBody = z.infer<typeof CiPreviewBody>;

export const CiPreviewResponse = z.object({
  files: z.array(CiFile),
});
export type CiPreviewResponse = z.infer<typeof CiPreviewResponse>;

export const CiExportBody = CiExportInput.extend({
  repo: RepoField,
  workflow_override: z.string().max(200_000).optional(),
});
export type CiExportBody = z.infer<typeof CiExportBody>;

export const CiOpenPrResponse = CiExport.extend({
  ingest_token: z.string().optional(),
  ingest_secret_name: z.string(),
});
export type CiOpenPrResponse = z.infer<typeof CiOpenPrResponse>;

export const CiPrepareInstallResponse = z.object({
  ingest_token: z.string().optional(),
  ingest_secret_name: z.string(),
  token_minted: z.boolean(),
});
export type CiPrepareInstallResponse = z.infer<typeof CiPrepareInstallResponse>;

export const CiInstallationListItem = CiInstallation.extend({
  last_status: CiRunStatus.nullable(),
  last_activity_at: z.string().nullable(),
  exported_agent_version: z.string().nullable(),
});
export type CiInstallationListItem = z.infer<typeof CiInstallationListItem>;

export const CiInstallationListResponse = z.object({
  items: z.array(CiInstallationListItem),
});
export type CiInstallationListResponse = z.infer<typeof CiInstallationListResponse>;

export const CiRunListItem = z.object({
  id: z.string(),
  repository: z.string().nullable(),
  pr_number: z.number().int().nullable(),
  agent_id: z.string().nullable(),
  agent_name: z.string().nullable(),
  verdict: z.string().nullable(),
  findings_count: z.number().int().nullable(),
  cost_usd: z.number().nullable(),
  duration_ms: z.number().int().nullable(),
  job_url: z.string().nullable(),
  status: z.string().nullable(),
  ran_at: z.string(),
});
export type CiRunListItem = z.infer<typeof CiRunListItem>;

export const CiRunListResponse = z.object({
  items: z.array(CiRunListItem),
});
export type CiRunListResponse = z.infer<typeof CiRunListResponse>;

export const CiRunsQuery = z.object({
  agent_id: z.string().uuid().optional(),
});
export type CiRunsQuery = z.infer<typeof CiRunsQuery>;

export const CiIngestBody = CiResultArtifact.extend({
  job_url: z.string().url().max(2048),
  commit_sha: z.string().min(1).max(64),
  model: z.string().min(1).max(200),
  manifest_version: z.string().min(1).max(64),
  tool_versions: z.record(z.string(), z.string()).optional(),
  verdict: z.string().max(64).optional(),
  repo: z.string().max(200).optional(),
  status: z.string().max(64).optional(),
});
export type CiIngestBody = z.infer<typeof CiIngestBody>;

export const CiIngestResponse = z.object({
  id: z.string(),
  updated: z.boolean(),
});
export type CiIngestResponse = z.infer<typeof CiIngestResponse>;

export const CiTargetOnly = CiTarget;
