/* hooks/intent.ts — React Query hooks for PR Intent Layer. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../api";
import type { PrIntentRecord } from "@devdigest/shared";

/** Persisted intent for a PR; `null` when never derived (404). */
export function usePrIntent(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["pr-intent", prId],
    queryFn: async (): Promise<PrIntentRecord | null> => {
      try {
        return await api.get<PrIntentRecord>(`/pulls/${prId}/intent`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!prId,
  });
}

/** Re-derive intent (POST) and refresh the cache. */
export function useDerivePrIntent(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<PrIntentRecord>(`/pulls/${prId}/intent`),
    onSuccess: (data) => {
      qc.setQueryData(["pr-intent", prId], data);
      qc.invalidateQueries({ queryKey: ["pr-intent", prId] });
    },
  });
}
