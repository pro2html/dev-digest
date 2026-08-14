/**
 * Onboarding tour — generate, read, clone preview.
 */
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { OnboardingTour } from '@devdigest/shared';
import { wrapUntrusted } from '@devdigest/reviewer-core';
import type { Container } from '../../platform/container.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import { TimeoutError, withTimeout } from '../../platform/resilience.js';
import { renderPrompt } from '../../platform/prompts.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import {
  CLONE_UNAVAILABLE_CODE,
  EXTRACT_TIMEOUT_MS,
  FILE_UNAVAILABLE_CODE,
  GENERATE_CLONE_DEPTH,
  GENERATION_FAILED_CODE,
  GITHUB_TOKEN_SECRET,
  INVALID_PATH_CODE,
  MAX_PREVIEW_BYTES,
  PROMPT_NAME,
  SECTION_LIST_TEXT,
  VALIDATION_RETRIES,
} from './constants.js';
import { collectFacts } from './facts.js';
import { groundTour } from './ground.js';
import { isPathSafe, isUtf8, toPosixRel, withGitHubToken } from './helpers.js';
import { OnboardingLlmOutput } from './llm-schema.js';
import { emptyTour, OnboardingRepository, type RepoBasics } from './repository.js';

export type OnboardingFilePreview = {
  path: string;
  content: string;
};

export class OnboardingService {
  private repo: OnboardingRepository;

  constructor(private container: Container) {
    this.repo = new OnboardingRepository(container.db);
  }

  async getTour(workspaceId: string, repoId: string): Promise<OnboardingTour> {
    const repoRow = await this.repo.getRepo(workspaceId, repoId);
    if (!repoRow) throw new NotFoundError('Repository not found');
    const stored = await this.repo.getByRepoId(repoId);
    return stored ?? emptyTour();
  }

  async generate(workspaceId: string, repoId: string, log?: { info: (obj: unknown) => void }): Promise<OnboardingTour> {
    const repoRow = await this.requireRepo(workspaceId, repoId);
    const clonePath = await this.ensureClone(repoRow, log);

    let facts;
    try {
      facts = await collectFacts(clonePath, repoId, {
        getIndexState: (id) => this.container.repoIntel.getIndexState(id),
        getTopFilesByRank: (id, n) => this.container.repoIntel.getTopFilesByRank(id, n),
        getCriticalPaths: (id) => this.container.repoIntel.getCriticalPaths(id),
      });
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as { code?: string }).code === CLONE_UNAVAILABLE_CODE) {
        throw new AppError(CLONE_UNAVAILABLE_CODE, 'Repository clone is not available', 409);
      }
      throw err;
    }

    const { provider, model } = await resolveFeatureModel(this.container, workspaceId, 'onboarding');
    const llm = await this.container.llm(provider);
    const system = await renderPrompt(PROMPT_NAME, {
      sections: SECTION_LIST_TEXT,
      language: 'English',
    });
    const user = wrapUntrusted('onboarding-facts', facts.block);

    let lastReason = 'invalid structured result';
    for (let attempt = 0; attempt <= VALIDATION_RETRIES; attempt++) {
      let data: OnboardingLlmOutput;
      try {
        const res = await withTimeout(
          llm.completeStructured<OnboardingLlmOutput>({
            model,
            schema: OnboardingLlmOutput,
            schemaName: 'OnboardingTourWrite',
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            temperature: 0,
            maxRetries: 2,
          }),
          EXTRACT_TIMEOUT_MS,
        );
        data = res.data;
        log?.info({
          msg: 'onboarding.generate.model',
          repoId,
          model,
          attempt,
          tokensIn: res.tokensIn,
          tokensOut: res.tokensOut,
        });
      } catch (err) {
        if (err instanceof TimeoutError) {
          throw new AppError(GENERATION_FAILED_CODE, 'Onboarding generation timed out', 502);
        }
        throw new AppError(
          GENERATION_FAILED_CODE,
          `Onboarding generation failed: ${err instanceof Error ? err.message : 'unknown error'}`,
          502,
        );
      }

      const grounded = await groundTour(data, {
        clonePath,
        readmeText: facts.readmeText,
        envNames: facts.envNames,
      });
      if (grounded.ok) {
        return this.repo.upsert(repoId, grounded.sections, facts.filesIndexed);
      }
      lastReason = grounded.reason;
    }

    throw new AppError(GENERATION_FAILED_CODE, `Onboarding generation failed: ${lastReason}`, 502);
  }

  async previewFile(workspaceId: string, repoId: string, relPath: string): Promise<OnboardingFilePreview> {
    const repoRow = await this.requireRepo(workspaceId, repoId);
    const clonePath = await this.readableClone(repoRow.clonePath);
    if (!clonePath) {
      throw new AppError(CLONE_UNAVAILABLE_CODE, 'Repository clone is not available', 409);
    }
    const posix = toPosixRel(relPath);
    if (!posix || !isPathSafe(posix, clonePath)) {
      throw new AppError(INVALID_PATH_CODE, `Invalid path: ${relPath}`, 422);
    }
    try {
      const abs = resolve(clonePath, posix);
      const st = await stat(abs);
      if (!st.isFile()) {
        throw new AppError(FILE_UNAVAILABLE_CODE, 'File is unavailable', 404);
      }
      const buf = await readFile(abs);
      if (!isUtf8(buf)) {
        throw new AppError(FILE_UNAVAILABLE_CODE, 'File is unavailable', 404);
      }
      const content = buf.subarray(0, MAX_PREVIEW_BYTES).toString('utf8');
      return { path: posix, content };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(FILE_UNAVAILABLE_CODE, 'File is unavailable', 404);
    }
  }

  private async requireRepo(workspaceId: string, repoId: string) {
    const repoRow = await this.repo.getRepo(workspaceId, repoId);
    if (!repoRow) throw new NotFoundError('Repository not found');
    return repoRow;
  }

  /**
   * Prefer the stored clone path; if the row is empty/stale, reuse an on-disk
   * clone at the GitClient dest; otherwise clone from GitHub then persist.
   */
  private async ensureClone(
    repoRow: RepoBasics,
    log?: { info: (obj: unknown) => void },
  ): Promise<string> {
    const stored = await this.readableClone(repoRow.clonePath);
    if (stored) return stored;

    const ref = { owner: repoRow.owner, name: repoRow.name };
    const expected = this.container.git.clonePathFor(ref);
    const onDisk = await this.readableClone(expected);
    if (onDisk) {
      await this.repo.updateClonePath(repoRow.id, onDisk);
      log?.info({ msg: 'onboarding.generate.clone.recovered', repoId: repoRow.id });
      return onDisk;
    }

    try {
      const token = await this.container.secrets.get(GITHUB_TOKEN_SECRET);
      const url = `https://github.com/${repoRow.fullName}.git`;
      const cloneUrl = token ? withGitHubToken(url, token) : url;
      const { path } = await this.container.git.clone(ref, cloneUrl, {
        depth: GENERATE_CLONE_DEPTH,
      });
      const cloned = await this.readableClone(path);
      if (!cloned) {
        this.throwCloneUnavailable();
      }
      await this.repo.updateClonePath(repoRow.id, cloned);
      log?.info({ msg: 'onboarding.generate.clone.fetched', repoId: repoRow.id });
      return cloned;
    } catch (err) {
      if (err instanceof AppError) throw err;
      this.throwCloneUnavailable();
    }
  }

  private throwCloneUnavailable(): never {
    throw new AppError(CLONE_UNAVAILABLE_CODE, 'Repository clone is not available', 409);
  }

  private async readableClone(clonePath: string | null): Promise<string | null> {
    if (!clonePath) return null;
    try {
      const st = await stat(clonePath);
      return st.isDirectory() ? clonePath : null;
    } catch {
      return null;
    }
  }
}
