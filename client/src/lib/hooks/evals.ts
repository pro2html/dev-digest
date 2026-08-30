/* hooks/evals.ts — React Query hooks for the eval pipeline. */
"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  EvalCaseFromFinding,
  EvalCaseFromFindingInput,
  EvalCaseInput,
  EvalCaseListItem,
  EvalOwnerDashboard,
  EvalOwnerKind,
  EvalRunAllAgentsResult,
  EvalRunComparison,
  EvalRunResult,
  EvalSetRun,
  EvalWorkspaceDashboard,
} from "@devdigest/shared";
import { api } from "../api";

function ownerPath(kind: EvalOwnerKind, id: string) {
  return `/evals/owners/${kind}/${id}`;
}

export function useEvalCases(ownerKind: EvalOwnerKind, ownerId: string | null | undefined) {
  return useQuery({
    queryKey: ["eval-cases", ownerKind, ownerId],
    queryFn: () => api.get<EvalCaseListItem[]>(`${ownerPath(ownerKind, ownerId!)}/cases`),
    enabled: !!ownerId,
  });
}

export function useEvalOwnerDashboard(ownerKind: EvalOwnerKind, ownerId: string | null | undefined) {
  return useQuery({
    queryKey: ["eval-dashboard", ownerKind, ownerId],
    queryFn: () => api.get<EvalOwnerDashboard>(`${ownerPath(ownerKind, ownerId!)}/dashboard`),
    enabled: !!ownerId,
  });
}

export function useEvalHistory(ownerKind: EvalOwnerKind, ownerId: string | null | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["eval-history", ownerKind, ownerId],
    queryFn: () => api.get<EvalSetRun[]>(`${ownerPath(ownerKind, ownerId!)}/runs`),
    enabled: !!ownerId,
    refetchInterval: (q) => {
      const rows = q.state.data;
      return rows?.some((r) => r.status === "queued" || r.status === "running") ? 1000 : false;
    },
  });
  const inflight = query.data?.some((r) => r.status === "queued" || r.status === "running") ?? false;
  const wasLive = useRef(false);
  useEffect(() => {
    if (!ownerId) return;
    if (inflight || wasLive.current) {
      void qc.invalidateQueries({ queryKey: ["eval-cases", ownerKind, ownerId] });
      void qc.invalidateQueries({ queryKey: ["eval-dashboard", ownerKind, ownerId] });
    }
    wasLive.current = inflight;
  }, [inflight, query.dataUpdatedAt, ownerKind, ownerId, qc]);
  return query;
}

export function useEvalSetRun(runId: string | null | undefined) {
  return useQuery({
    queryKey: ["eval-set-run", runId],
    queryFn: () => api.get<EvalSetRun>(`/evals/set-runs/${runId}`),
    enabled: !!runId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "queued" || s === "running" ? 1000 : false;
    },
  });
}

export function useWorkspaceEvalDashboard() {
  return useQuery({
    queryKey: ["eval-workspace-dashboard"],
    queryFn: () => api.get<EvalWorkspaceDashboard>("/evals/dashboard"),
  });
}

export function useCreateEvalCase(ownerKind: EvalOwnerKind, ownerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EvalCaseInput) =>
      api.post<EvalCaseListItem>(`${ownerPath(ownerKind, ownerId)}/cases`, input),
    onSuccess: () => invalidateOwner(qc, ownerKind, ownerId),
  });
}

export function useUpdateEvalCase(ownerKind: EvalOwnerKind, ownerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EvalCaseInput }) =>
      api.patch<EvalCaseListItem>(`/evals/cases/${id}`, input),
    onSuccess: () => invalidateOwner(qc, ownerKind, ownerId),
  });
}

export function useDeleteEvalCase(ownerKind: EvalOwnerKind, ownerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/evals/cases/${id}`),
    onSuccess: () => invalidateOwner(qc, ownerKind, ownerId),
  });
}

export function useRunEvalCase(ownerKind: EvalOwnerKind, ownerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<EvalRunResult>(`/evals/cases/${id}/run`),
    onSuccess: () => invalidateOwner(qc, ownerKind, ownerId),
  });
}

export function useStartEvalSetRun(ownerKind: EvalOwnerKind, ownerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<EvalSetRun>(`${ownerPath(ownerKind, ownerId)}/runs`, {}),
    onSuccess: () => invalidateOwner(qc, ownerKind, ownerId),
  });
}

export function useCancelEvalSetRun(ownerKind: EvalOwnerKind, ownerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.post<EvalSetRun>(`/evals/set-runs/${runId}/cancel`),
    onSuccess: () => invalidateOwner(qc, ownerKind, ownerId),
  });
}

export function useCompareEvalRuns() {
  return useMutation({
    mutationFn: ({
      ownerKind,
      ownerId,
      a,
      b,
    }: {
      ownerKind: EvalOwnerKind;
      ownerId: string;
      a: string;
      b: string;
    }) =>
      api.get<EvalRunComparison>(
        `${ownerPath(ownerKind, ownerId)}/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`,
      ),
  });
}

export function useRunAllAgentsEvals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<EvalRunAllAgentsResult>("/evals/run-all-agents"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eval-workspace-dashboard"] });
      qc.invalidateQueries({ queryKey: ["eval-history"] });
    },
  });
}

export function useCreateEvalCaseFromFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: string | { findingId: string; input?: EvalCaseFromFindingInput }) => {
      const findingId = typeof arg === "string" ? arg : arg.findingId;
      const body = typeof arg === "string" ? undefined : arg.input;
      return api.post<EvalCaseListItem>(`/findings/${findingId}/eval-case`, body);
    },
    onSuccess: (created) => {
      invalidateOwner(qc, created.owner_kind, created.owner_id);
    },
  });
}

export function useEvalCaseDraftFromFinding() {
  return useMutation({
    mutationFn: (findingId: string) => api.get<EvalCaseFromFinding>(`/findings/${findingId}/eval-case`),
  });
}

function invalidateOwner(
  qc: ReturnType<typeof useQueryClient>,
  ownerKind: EvalOwnerKind,
  ownerId: string,
) {
  qc.invalidateQueries({ queryKey: ["eval-cases", ownerKind, ownerId] });
  qc.invalidateQueries({ queryKey: ["eval-dashboard", ownerKind, ownerId] });
  qc.invalidateQueries({ queryKey: ["eval-history", ownerKind, ownerId] });
  qc.invalidateQueries({ queryKey: ["eval-workspace-dashboard"] });
}
