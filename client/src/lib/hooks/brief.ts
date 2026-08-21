/* hooks/brief.ts — React Query hooks for the PR Why+Risk Brief. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { WhyRiskBriefRecord } from "@devdigest/shared";

export function usePrBrief(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["pr-brief", prId],
    queryFn: () => api.get<WhyRiskBriefRecord>(`/pulls/${prId}/brief`),
    enabled: !!prId,
  });
}

/** Generate or regenerate. Always POSTs; invalidates the GET cache. */
export function useGeneratePrBrief(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<WhyRiskBriefRecord>(`/pulls/${prId}/brief`),
    onSuccess: (data) => {
      qc.setQueryData(["pr-brief", prId], data);
      qc.invalidateQueries({ queryKey: ["pr-brief", prId] });
    },
  });
}
