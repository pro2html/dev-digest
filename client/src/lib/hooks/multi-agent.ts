/* hooks/multi-agent.ts — parent multi-agent run start + reads. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Conflict, MultiAgentRun } from "@devdigest/shared";
import { api } from "../api";

export interface MultiAgentGetEnvelope {
  pr_id: string;
  run: MultiAgentRun | null;
  grouped_locations: Conflict[];
}

export interface AgentReviewEstimate {
  agent_id: string;
  estimate_duration_ms: number | null;
  estimate_cost_usd: number | null;
}

export interface MultiAgentListEnvelope {
  pr_id: string;
  runs: MultiAgentRun[];
}

export function useReviewEstimates() {
  return useQuery({
    queryKey: ["review-estimates"],
    queryFn: () => api.get<AgentReviewEstimate[]>("/agents/review-estimates"),
  });
}

export function useLatestMultiAgentRun(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["multi-agent", prId],
    queryFn: () => api.get<MultiAgentGetEnvelope>(`/pulls/${prId}/multi-agent`),
    enabled: !!prId,
  });
}

export function useMultiAgentRunsForPull(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["multi-agent-list", prId],
    queryFn: () => api.get<MultiAgentListEnvelope>(`/pulls/${prId}/multi-agent-runs`),
    enabled: !!prId,
    refetchInterval: (query) =>
      (query.state.data?.runs ?? []).some((r) => r.columns.some((c) => c.status === "running"))
        ? 4000
        : false,
  });
}

export function useMultiAgentRunById(runId: string | null | undefined) {
  return useQuery({
    queryKey: ["multi-agent-run", runId],
    queryFn: () => api.get<MultiAgentGetEnvelope>(`/multi-agent-runs/${runId}`),
    enabled: !!runId,
  });
}

export function useStartMultiAgentRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ prId, agentIds }: { prId: string; agentIds: string[] }) =>
      api.post<MultiAgentRun>(`/pulls/${prId}/multi-agent-run`, { agent_ids: agentIds }),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ["multi-agent", run.pr_id] });
      qc.invalidateQueries({ queryKey: ["multi-agent-list", run.pr_id] });
      qc.invalidateQueries({ queryKey: ["multi-agent-run", run.id] });
      qc.invalidateQueries({ queryKey: ["pr-active-runs", run.pr_id] });
      qc.invalidateQueries({ queryKey: ["pr-runs", run.pr_id] });
      qc.invalidateQueries({ queryKey: ["reviews", run.pr_id] });
    },
  });
}
