/* hooks/agents.ts — React Query hooks for the A2 Agents tab + Agent Editor. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  Agent,
  AgentSkillLinkView,
  ModelInfo,
  Provider,
  ReviewStrategy,
} from "@devdigest/shared";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/agents"),
  });
}

export function useAgent(id: string | null | undefined) {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: () => api.get<Agent>(`/agents/${id}`),
    enabled: !!id,
  });
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  provider: Provider;
  model: string;
  system_prompt: string;
  output_schema?: unknown;
  strategy?: ReviewStrategy;
  enabled?: boolean;
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgentInput) => api.post<Agent>("/agents", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export interface UpdateAgentInput {
  id: string;
  patch: Partial<
    Pick<
      Agent,
      | "name"
      | "description"
      | "provider"
      | "model"
      | "system_prompt"
      | "output_schema"
      | "strategy"
      | "ci_fail_on"
      | "repo_intel"
      | "enabled"
    >
  >;
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateAgentInput) => api.put<Agent>(`/agents/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.setQueryData(["agent", data.id], data);
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/agents/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.removeQueries({ queryKey: ["agent", id] });
    },
  });
}

/** Dynamic model list for a provider (editor model picker). */
export function useProviderModels(provider: Provider | null | undefined) {
  return useQuery({
    queryKey: ["provider-models", provider],
    queryFn: () => api.get<ModelInfo[]>(`/providers/${provider}/models`),
    enabled: !!provider,
    staleTime: 5 * 60_000,
  });
}

/** Linked skills for an agent (ordered AgentSkillLinkView[]). */
export function useAgentSkills(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-skills", agentId],
    queryFn: () => api.get<AgentSkillLinkView[]>(`/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

export interface AgentSkillLinkInput {
  skill_id: string;
  order: number;
  enabled: boolean;
}

/** Replace / reorder the full set of linked skills. */
export function useSetAgentSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, skills }: { agentId: string; skills: AgentSkillLinkInput[] }) =>
      api.post<AgentSkillLinkView[]>(`/agents/${agentId}/skills`, { skills }),
    onSuccess: (data, { agentId }) => {
      qc.setQueryData(["agent-skills", agentId], data);
      qc.invalidateQueries({ queryKey: ["skill-stats"] });
      qc.invalidateQueries({ queryKey: ["context"] });
    },
  });
}

/** Toggle enabled on one agent↔skill link. */
export function useToggleAgentSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      agentId,
      skillId,
      enabled,
    }: {
      agentId: string;
      skillId: string;
      enabled: boolean;
    }) => api.patch<AgentSkillLinkView[]>(`/agents/${agentId}/skills/${skillId}`, { enabled }),
    onSuccess: (data, { agentId }) => {
      qc.setQueryData(["agent-skills", agentId], data);
      qc.invalidateQueries({ queryKey: ["skill-stats"] });
      qc.invalidateQueries({ queryKey: ["context"] });
    },
  });
}

/** Unlink a skill from an agent. */
export function useUnlinkAgentSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, skillId }: { agentId: string; skillId: string }) =>
      api.del<AgentSkillLinkView[]>(`/agents/${agentId}/skills/${skillId}`),
    onSuccess: (data, { agentId }) => {
      qc.setQueryData(["agent-skills", agentId], data);
      qc.invalidateQueries({ queryKey: ["skill-stats"] });
      qc.invalidateQueries({ queryKey: ["context"] });
    },
  });
}

/** Append one skill to the agent's linked set. */
export function useLinkAgentSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, skillId }: { agentId: string; skillId: string }) =>
      api.post<AgentSkillLinkView[]>(`/agents/${agentId}/skills`, { skill_id: skillId }),
    onSuccess: (data, { agentId }) => {
      qc.setQueryData(["agent-skills", agentId], data);
      qc.invalidateQueries({ queryKey: ["skill-stats"] });
      qc.invalidateQueries({ queryKey: ["context"] });
    },
  });
}
