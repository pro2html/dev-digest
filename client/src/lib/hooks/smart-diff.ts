/* hooks/smart-diff.ts — React Query hook for Smart Diff (compute-on-read). */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { SmartDiff } from "@devdigest/shared";

/** Smart Diff grouping for a PR; empty finding_lines until a review exists. */
export function useSmartDiff(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["smart-diff", prId],
    queryFn: () => api.get<SmartDiff>(`/pulls/${prId}/smart-diff`),
    enabled: !!prId,
  });
}
