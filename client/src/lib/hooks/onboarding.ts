/* hooks/onboarding.ts — React Query hooks for the repo Onboarding Tour. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { OnboardingTour } from "@devdigest/shared";

export type OnboardingFilePreview = {
  path: string;
  content: string;
};

export function useOnboarding(repoId: string | null | undefined) {
  return useQuery({
    queryKey: ["onboarding", repoId],
    queryFn: () => api.get<OnboardingTour>(`/repos/${repoId}/onboarding`),
    enabled: !!repoId,
  });
}

export function useGenerateOnboarding(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<OnboardingTour>(`/repos/${repoId}/onboarding/generate`),
    onSuccess: (data) => {
      qc.setQueryData(["onboarding", repoId], data);
      qc.invalidateQueries({ queryKey: ["onboarding", repoId] });
    },
  });
}

export function useOnboardingFile(repoId: string) {
  return useMutation({
    mutationFn: (path: string) =>
      api.get<OnboardingFilePreview>(
        `/repos/${repoId}/onboarding/file?path=${encodeURIComponent(path)}`,
      ),
  });
}
