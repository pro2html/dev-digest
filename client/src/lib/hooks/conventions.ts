/* hooks/conventions.ts — React Query hooks for the Conventions Extractor. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  ConventionCandidate,
  ConventionsListResponse,
  ConventionSkillDraft,
  ConventionStatus,
  ConventionCategory,
  Skill,
} from "@devdigest/shared";

export function useConventions(repoId: string | null | undefined, status?: ConventionStatus) {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["conventions", repoId, status ?? null],
    queryFn: () => api.get<ConventionsListResponse>(`/repos/${repoId}/conventions${qs}`),
    enabled: !!repoId,
  });
}

export function useExtractConventions(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ scan: unknown; candidates: ConventionCandidate[] }>(
        `/repos/${repoId}/conventions/extract`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conventions", repoId] });
    },
  });
}

export interface PatchConventionInput {
  id: string;
  rule?: string;
  category?: ConventionCategory;
  status?: ConventionStatus;
}

export function usePatchConvention(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: PatchConventionInput) =>
      api.patch<ConventionCandidate>(`/conventions/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conventions", repoId] });
    },
  });
}

export function useConventionSkillDraft(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post<ConventionSkillDraft>(`/repos/${repoId}/conventions/skill-draft`, { ids }),
  });
}

export interface CreateSkillFromConventionsInput {
  ids: string[];
  name: string;
  description?: string;
  type?: string;
  body: string;
  enabled?: boolean;
  agent_id?: string;
}

export function useCreateSkillFromConventions(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillFromConventionsInput) =>
      api.post<Skill>(`/repos/${repoId}/conventions/skill`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["conventions", repoId] });
      qc.invalidateQueries({ queryKey: ["agent-skills"] });
    },
  });
}
