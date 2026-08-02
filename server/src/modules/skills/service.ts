import type { Container } from '../../platform/container.js';
import type {
  Skill,
  SkillStats,
  SkillType,
  SkillVersion,
} from '@devdigest/shared';
import { SkillsRepository } from './repository.js';
import {
  nameFromImportedMarkdown,
  toSkillDto,
  toSkillVersionDto,
} from './helpers.js';

/**
 * Skills service. Business logic for the Skills Lab — CRUD, import, versions,
 * and approximate stats. Workspace-scoped throughout.
 */

export { toSkillDto } from './helpers.js';

export interface CreateSkillInput {
  name: string;
  description?: string;
  type: SkillType;
  body: string;
  enabled?: boolean;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

export interface ImportSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  body: string;
}

export class SkillsService {
  private repo: SkillsRepository;

  constructor(private container: Container) {
    this.repo = container.skillsRepo;
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map(toSkillDto);
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    return row ? toSkillDto(row) : undefined;
  }

  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      source: 'manual',
      body: input.body,
      enabled: input.enabled,
    });
    return toSkillDto(row);
  }

  /**
   * Import a skill from markdown. Always `source: 'imported_url'` and
   * `enabled: false` — vetting is required before the skill can enter a prompt.
   */
  async import(workspaceId: string, input: ImportSkillInput): Promise<Skill> {
    const name =
      input.name !== undefined && input.name.trim().length > 0
        ? input.name.trim()
        : nameFromImportedMarkdown(input.body);
    const row = await this.repo.insert({
      workspaceId,
      name,
      description: input.description,
      type: input.type ?? 'custom',
      source: 'imported_url',
      body: input.body,
      enabled: false,
    });
    return toSkillDto(row);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkillInput,
  ): Promise<Skill | undefined> {
    const row = await this.repo.update(workspaceId, id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    });
    return row ? toSkillDto(row) : undefined;
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  /**
   * Body history for a skill, newest first. Returns undefined when the skill
   * isn't in this workspace (route → 404).
   */
  async listVersions(workspaceId: string, skillId: string): Promise<SkillVersion[] | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    const rows = await this.repo.listVersions(skillId);
    return rows.map(toSkillVersionDto);
  }

  async getVersion(
    workspaceId: string,
    skillId: string,
    version: number,
  ): Promise<SkillVersion | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    const row = await this.repo.getVersion(skillId, version);
    return row ? toSkillVersionDto(row) : undefined;
  }

  async stats(workspaceId: string, skillId: string): Promise<SkillStats | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    const row = await this.repo.stats(skillId);
    return {
      used_by_agents: row.usedByAgents,
      findings_30d: row.findings30d,
      findings_by_category: row.findingsByCategory,
      // TODO(skills-telemetry): pull_frequency / accept_rate are not tracked yet.
      pull_frequency: null,
      accept_rate: null,
      agents: row.agents,
    };
  }
}
