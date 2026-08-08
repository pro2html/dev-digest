/* hooks/blast.ts — React Query hook for PR Blast Radius map. */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { PrBlastRecord } from "@devdigest/shared";

/** Blast radius map for a PR (`GET /pulls/:id/blast`). */
export function usePrBlast(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["pr-blast", prId],
    queryFn: () => api.get<PrBlastRecord>(`/pulls/${prId}/blast`),
    enabled: !!prId,
  });
}
