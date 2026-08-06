/**
 * Conventions Extractor — composer (PURE logic) + skill creation service.
 *
 * Composes accepted candidates into a single markdown skill body.
 */
import type { SkillType } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import { ConventionsRepository, type ConventionRow } from './repository.js';
import { slug, fenceLanguage, rowToDto } from './helpers.js';

export interface SkillDraft {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  evidence_files: string[];
}

export interface CreateSkillInput {
  ids: string[];
  name: string;
  description?: string;
  type?: SkillType;
  body: string;
  enabled?: boolean;
  agent_id?: string;
}

export class ComposerService {
  private repo: ConventionsRepository;

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
  }

  async draft(workspaceId: string, repoId: string, ids: string[]): Promise<SkillDraft> {
    const repoRow = await this.repo.getRepo(workspaceId, repoId);
    if (!repoRow) throw new NotFoundError('Repository not found');

    const candidates = await this.repo.listByIds(workspaceId, ids);
    if (candidates.length === 0) throw new ValidationError('No candidates found');

    const accepted = candidates.filter((c) => c.status === 'accepted');
    if (accepted.length === 0) throw new ValidationError('No accepted candidates in selection');

    const repoName = slugifyRepoName(repoRow.fullName);
    const body = composeBody(repoName, accepted);
    const evidenceFiles = getEvidenceFiles(accepted);

    return {
      name: `${repoName}-conventions`,
      description: `${accepted.length} house conventions extracted from ${repoRow.fullName}`,
      type: 'convention',
      body,
      evidence_files: evidenceFiles,
    };
  }

  async createSkill(workspaceId: string, repoId: string, input: CreateSkillInput) {
    const repoRow = await this.repo.getRepo(workspaceId, repoId);
    if (!repoRow) throw new NotFoundError('Repository not found');

    const candidates = await this.repo.listByIds(workspaceId, input.ids);
    if (candidates.length !== input.ids.length) {
      throw new ValidationError('Some candidate ids are unknown');
    }

    const nonAccepted = candidates.filter((c) => c.status !== 'accepted');
    if (nonAccepted.length > 0) {
      throw new ValidationError('All candidates must be accepted before creating a skill');
    }

    const evidenceFiles = getEvidenceFiles(candidates);
    const skill = await this.container.skillsRepo.insert({
      workspaceId,
      name: input.name,
      description: input.description ?? `Conventions extracted from ${repoRow.fullName}`,
      type: input.type ?? 'convention',
      source: 'extracted',
      body: input.body,
      enabled: input.enabled ?? true,
      evidenceFiles,
    });

    await this.repo.attachSkill(workspaceId, input.ids, skill.id);

    if (input.agent_id) {
      const agentsService = await import('../agents/service.js');
      const svc = new agentsService.AgentsService(this.container);
      const linked = await svc.linkSkill(workspaceId, input.agent_id, skill.id);
      if (linked === false) {
        throw new ValidationError('Agent is not in this workspace');
      }
      if (linked === undefined) {
        throw new NotFoundError('Agent not found');
      }
    }

    return {
      ...skill,
      evidence_files: evidenceFiles,
    };
  }
}

/** Compose markdown skill body from accepted candidates. */
export function composeBody(repoName: string, candidates: ConventionRow[]): string {
  const sorted = [...candidates].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });

  const slugs = new Set<string>();
  const sections = sorted.map((c) => {
    const sectionSlug = slug(c.rule, slugs);
    const lang = fenceLanguage(c.evidencePath ?? '');
    const fenceOpen = lang ? `\`\`\`${lang}` : '```';

    let section = `## ${sectionSlug}\n${c.rule}\n`;
    if (c.appliesTo) {
      section += `\nApplies to: \`${c.appliesTo}\`\n`;
    }
    if (c.evidencePath && c.evidenceSnippet) {
      const lineRef = c.evidenceLine ? `:${c.evidenceLine}` : '';
      section += `\nDetected in \`${c.evidencePath}${lineRef}\`:\n\n${fenceOpen}\n${c.evidenceSnippet}\n\`\`\`\n`;
    }
    return section;
  });

  const header = `# ${repoName}-conventions\n\nHouse conventions for \`${repoName}\`. Flag changes that violate any rule below and cite the offending \`file:line\`.\n`;
  return header + '\n' + sections.join('\n');
}

function getEvidenceFiles(candidates: ConventionRow[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of candidates) {
    if (c.evidencePath && !seen.has(c.evidencePath)) {
      seen.add(c.evidencePath);
      result.push(c.evidencePath);
    }
  }
  return result;
}

function slugifyRepoName(fullName: string): string {
  return fullName
    .split('/')
    .pop()!
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
