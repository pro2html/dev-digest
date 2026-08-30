/* hooks/ci.ts — React Query hooks for Export to CI. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiDownload } from "../api";
import type { CiExportInputBody, CiFile } from "@devdigest/shared";

export type CiInstallationRow = {
  id: string;
  agent_id: string;
  repo: string;
  target_type: "gha" | "circle" | "jenkins" | "cli";
  installed_at: string;
  last_status: "succeeded" | "failed" | "no_findings" | "running" | null;
  last_activity_at: string | null;
  exported_agent_version: string | null;
};

export type CiRunRow = {
  id: string;
  repository: string | null;
  pr_number: number | null;
  agent_id: string | null;
  agent_name: string | null;
  verdict: string | null;
  findings_count: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  job_url: string | null;
  status: string | null;
  ran_at: string;
};

export type CiPreviewInput = Omit<CiExportInputBody, "action"> & {
  workflow_override?: string;
};

export type CiExportBody = CiExportInputBody & {
  workflow_override?: string;
};

export type CiOpenPrResult = {
  installation: {
    id: string;
    agent_id: string;
    repo: string;
    target_type: string;
    installed_at: string;
  };
  files: CiFile[];
  pr_url: string | null;
  ingest_token?: string;
  ingest_secret_name: string;
};

export type CiPrepareInstall = {
  ingest_token?: string;
  ingest_secret_name: string;
  token_minted: boolean;
};

export function useCiInstallations(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["ci-installations", agentId],
    queryFn: () => api.get<{ items: CiInstallationRow[] }>(`/agents/${agentId}/ci-installations`),
    enabled: !!agentId,
  });
}

export function useCiRuns(agentId?: string | null) {
  const qs = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : "";
  return useQuery({
    queryKey: ["ci-runs", agentId ?? "all"],
    queryFn: () => api.get<{ items: CiRunRow[] }>(`/ci-runs${qs}`),
  });
}

export function useCiPreview(agentId: string) {
  return useMutation({
    mutationFn: (body: CiPreviewInput) =>
      api.post<{ files: CiFile[] }>(`/agents/${agentId}/ci-preview`, body),
  });
}

export function useCiPrepareInstall(agentId: string) {
  return useMutation({
    mutationFn: () => api.post<CiPrepareInstall>(`/agents/${agentId}/ci-prepare-install`),
  });
}

export function useCiExportOpenPr(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CiExportBody) =>
      api.post<CiOpenPrResult>(`/agents/${agentId}/export-ci`, { ...body, action: "open_pr" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ci-installations", agentId] });
      void qc.invalidateQueries({ queryKey: ["ci-runs"] });
    },
  });
}

export function useCiExportZip(agentId: string) {
  return useMutation({
    mutationFn: (body: CiExportBody) =>
      apiDownload(`/agents/${agentId}/export-ci`, {
        method: "POST",
        body: JSON.stringify({ ...body, action: "files" }),
      }),
  });
}
