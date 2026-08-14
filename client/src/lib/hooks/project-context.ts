/* hooks/project-context.ts — attachment lists for agents and skills. */
"use client";

import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import { api } from "../api";
import type { AgentContextList, ContextCatalogFile, ContextImportFile, SkillContextList } from "@devdigest/shared";

export function useAgentContext(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-context", agentId],
    queryFn: () => api.get<AgentContextList>(`/agents/${agentId}/context`),
    enabled: !!agentId,
  });
}

export function useSetAgentContext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      agentId,
      repoId,
      documents,
    }: {
      agentId: string;
      repoId: string;
      documents: AgentContextList["documents"];
    }) =>
      api.put<AgentContextList>(`/agents/${agentId}/context?repoId=${encodeURIComponent(repoId)}`, {
        documents,
      }),
    onSuccess: (data, { agentId }) => {
      qc.setQueryData(["agent-context", agentId], data);
      qc.invalidateQueries({ queryKey: ["context"] });
    },
  });
}

export function useSkillContext(skillId: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-context", skillId],
    queryFn: () => api.get<SkillContextList>(`/skills/${skillId}/context`),
    enabled: !!skillId,
  });
}

export function useSkillContexts(skillIds: string[]) {
  return useQueries({
    queries: skillIds.map((id) => ({
      queryKey: ["skill-context", id],
      queryFn: () => api.get<SkillContextList>(`/skills/${id}/context`),
      enabled: !!id,
    })),
  });
}

export function useSetSkillContext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      skillId,
      repoId,
      documents,
    }: {
      skillId: string;
      repoId: string;
      documents: SkillContextList["documents"];
    }) =>
      api.put<SkillContextList>(`/skills/${skillId}/context?repoId=${encodeURIComponent(repoId)}`, {
        documents,
      }),
    onSuccess: (data, { skillId }) => {
      qc.setQueryData(["skill-context", skillId], data);
      qc.invalidateQueries({ queryKey: ["context"] });
    },
  });
}

export function useImportContextFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      repoId,
      filename,
      content,
    }: ContextImportFile & { repoId: string }) =>
      api.post<ContextCatalogFile>(`/repos/${repoId}/context/files`, { filename, content }),
    onSuccess: (_data, { repoId }) => {
      qc.invalidateQueries({ queryKey: ["context", repoId] });
    },
  });
}
