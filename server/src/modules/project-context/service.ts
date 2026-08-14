/**
 * Project-context service — catalog scan, attachment replace-full-list, run injection.
 */
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  AgentContextList,
  ContextCatalogFile,
  SkillContextList,
  SpecFile,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import { CLONE_UNAVAILABLE_CODE, INVALID_PATH_CODE } from './constants.js';
import { isAttachablePath, isUtf8, toPosixRel } from './helpers.js';
import { writeImportedContextFile } from './import-file.js';
import { ProjectContextRepository } from './repository.js';
import { scanCloneCatalog } from './scan.js';
import { unionEffectivePaths } from './union.js';
import { readInjectedSpecs } from './read.js';

export type RunLogLike = { info: (msg: string) => void };

export type ResolvedSpecs = {
  /** `### path\\ncontent` payloads; undefined when none injected (omit engine slot). */
  specs: string[] | undefined;
  specsRead: string[];
};

export class ProjectContextService {
  private repo: ProjectContextRepository;

  constructor(private container: Container) {
    this.repo = new ProjectContextRepository(container.db);
  }

  async listCatalog(workspaceId: string, repoId: string): Promise<ContextCatalogFile[]> {
    const clonePath = await this.requireClone(workspaceId, repoId);
    let scanned;
    try {
      scanned = await scanCloneCatalog(clonePath);
    } catch {
      throw this.cloneUnavailable();
    }
    const counts = await this.repo.usedByCounts(
      workspaceId,
      scanned.map((f) => f.path),
    );
    return scanned.map((f) => ({
      path: f.path,
      content: f.content,
      size: f.size,
      updated_at: f.updated_at,
      category: f.category,
      used_by_agents: counts.get(f.path) ?? 0,
    }));
  }

  async previewFile(workspaceId: string, repoId: string, relPath: string): Promise<SpecFile> {
    const clonePath = await this.requireClone(workspaceId, repoId);
    const posix = toPosixRel(relPath);
    if (!isAttachablePath(posix, clonePath)) {
      throw new AppError(INVALID_PATH_CODE, `Invalid project-context path: ${posix}`, 422);
    }
    const file = await this.readCloneFile(clonePath, posix);
    if (!file) throw new NotFoundError('File not found');
    return { path: posix, content: file.content, size: file.size, updated_at: file.updatedAt };
  }

  async importFile(
    workspaceId: string,
    repoId: string,
    filename: string,
    content: string,
  ): Promise<ContextCatalogFile> {
    const clonePath = await this.requireClone(workspaceId, repoId);
    const rel = await writeImportedContextFile(clonePath, filename, content);
    const file = await this.readCloneFile(clonePath, rel);
    if (!file) {
      throw new AppError(INVALID_PATH_CODE, `Could not read imported file: ${rel}`, 422);
    }
    const counts = await this.repo.usedByCounts(workspaceId, [rel]);
    return {
      path: rel,
      content: file.content,
      size: file.size,
      updated_at: file.updatedAt,
      category: 'docs',
      used_by_agents: counts.get(rel) ?? 0,
    };
  }

  async getAgentContext(workspaceId: string, agentId: string): Promise<AgentContextList> {
    const agent = await this.container.agentsRepo.getById(workspaceId, agentId);
    if (!agent) throw new NotFoundError('Agent not found');
    const documents = await this.repo.listAgentDocs(agentId);
    return { documents };
  }

  async putAgentContext(
    workspaceId: string,
    agentId: string,
    repoId: string,
    documents: { path: string; order: number }[],
  ): Promise<AgentContextList> {
    const agent = await this.container.agentsRepo.getById(workspaceId, agentId);
    if (!agent) throw new NotFoundError('Agent not found');
    const clonePath = await this.clonePathOrNull(workspaceId, repoId);
    this.assertAttachable(documents.map((d) => d.path), clonePath);
    const ordered = documents.map((d, i) => ({ path: toPosixRel(d.path), order: d.order ?? i }));
    await this.repo.setAgentDocs(agentId, ordered);
    return { documents: ordered };
  }

  async getSkillContext(workspaceId: string, skillId: string): Promise<SkillContextList> {
    const skill = await this.container.skillsRepo.getById(workspaceId, skillId);
    if (!skill) throw new NotFoundError('Skill not found');
    const docs = await this.repo.listSkillDocs(skillId);
    return { documents: docs.map((d) => ({ path: d.path })) };
  }

  async putSkillContext(
    workspaceId: string,
    skillId: string,
    repoId: string,
    documents: { path: string }[],
  ): Promise<SkillContextList> {
    const skill = await this.container.skillsRepo.getById(workspaceId, skillId);
    if (!skill) throw new NotFoundError('Skill not found');
    const clonePath = await this.clonePathOrNull(workspaceId, repoId);
    this.assertAttachable(documents.map((d) => d.path), clonePath);
    const ordered = documents.map((d, i) => ({ path: toPosixRel(d.path), order: i }));
    await this.repo.setSkillDocs(skillId, ordered);
    return { documents: ordered.map((d) => ({ path: d.path })) };
  }

  /**
   * Resolve effective specs for a studio run. Missing/unsafe paths are skipped
   * (AC-17); empty result omits the engine `specs` key (AC-14). Independent of
   * repo-intel.
   */
  async resolveForRun(agentId: string, clonePath: string, runLog?: RunLogLike): Promise<ResolvedSpecs> {
    const agentDocs = await this.repo.listAgentDocs(agentId);
    const inherited = await this.repo.listEnabledSkillDocsForAgent(agentId);
    const paths = unionEffectivePaths(agentDocs, inherited);
    const { specs, specsRead } = await readInjectedSpecs(clonePath, paths, (msg) =>
      runLog?.info(msg),
    );
    if (specs.length === 0) return { specs: undefined, specsRead: [] };
    return { specs, specsRead };
  }

  private async requireClone(workspaceId: string, repoId: string): Promise<string> {
    const repo = await this.repo.getRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repository not found');
    const clonePath = await this.readableClone(repo.clonePath);
    if (!clonePath) throw this.cloneUnavailable();
    return clonePath;
  }

  private async clonePathOrNull(workspaceId: string, repoId: string): Promise<string | null> {
    const repo = await this.repo.getRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repository not found');
    return this.readableClone(repo.clonePath);
  }

  private async readableClone(clonePath: string | null): Promise<string | null> {
    if (!clonePath) return null;
    try {
      const st = await stat(clonePath);
      if (!st.isDirectory()) return null;
      return clonePath;
    } catch {
      return null;
    }
  }

  private assertAttachable(paths: string[], clonePath: string | null): void {
    for (const raw of paths) {
      const posix = toPosixRel(raw);
      if (!isAttachablePath(posix, clonePath)) {
        throw new AppError(INVALID_PATH_CODE, `Invalid project-context path: ${posix}`, 422);
      }
    }
  }

  private async readCloneFile(
    clonePath: string,
    posix: string,
  ): Promise<{ content: string; size: number; updatedAt: string } | null> {
    try {
      const abs = resolve(clonePath, posix);
      const buf = await readFile(abs);
      if (!isUtf8(buf)) return null;
      const st = await stat(abs);
      return { content: buf.toString('utf8'), size: st.size, updatedAt: st.mtime.toISOString() };
    } catch {
      return null;
    }
  }

  private cloneUnavailable(): AppError {
    return new AppError(
      CLONE_UNAVAILABLE_CODE,
      'Repository clone is not available',
      409,
    );
  }
}
