/**
 * Conventions Extractor — service orchestration.
 * sample → LLM → verify → persist
 */
import type { ConventionCategory, ConventionStatus } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError, ValidationError, ExternalServiceError } from '../../platform/errors.js';
import { withTimeout, TimeoutError } from '../../platform/resilience.js';
import { renderPrompt } from '../../platform/prompts.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { wrapUntrusted } from '@devdigest/reviewer-core';
import { buildSampleSet } from './sampler.js';
import { verifyCandidates, type ExtractedCandidate } from './verifier.js';
import { ConventionsExtraction } from './llm-schema.js';
import { ConventionsRepository, type ConventionRow, type InsertConvention } from './repository.js';
import { ruleHash, rowToDto } from './helpers.js';
import {
  PROMPT_NAME,
  PROMPT_VERSION,
  CATEGORY_LIST_TEXT,
  MAX_CANDIDATES,
  EXTRACT_TIMEOUT_MS,
} from './constants.js';

export class ConventionsService {
  private repo: ConventionsRepository;

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
  }

  async extract(workspaceId: string, repoId: string, log?: { info: (obj: unknown) => void }) {
    const repoRow = await this.repo.getRepo(workspaceId, repoId);
    if (!repoRow) throw new NotFoundError('Repository not found');
    if (!repoRow.clonePath) throw new ValidationError('Repository has no local clone');

    const samples = await buildSampleSet(
      repoRow.clonePath,
      repoId,
      { getConventionSamples: (id, n) => this.container.repoIntel.getConventionSamples(id, n) },
    );

    const { provider, model } = await resolveFeatureModel(this.container, workspaceId, 'conventions');
    const llm = await this.container.llm(provider);
    const system = await renderPrompt(PROMPT_NAME, {
      categories: CATEGORY_LIST_TEXT,
      maxCandidates: String(MAX_CANDIDATES),
    });

    let res: { data: ConventionsExtraction; tokensIn: number; tokensOut: number; costUsd: number | null };
    try {
      res = await withTimeout(
        llm.completeStructured<ConventionsExtraction>({
          model,
          schema: ConventionsExtraction,
          schemaName: 'ConventionsExtraction',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: wrapUntrusted('repo-samples', samples.block) },
          ],
          temperature: 0,
          maxRetries: 2,
        }),
        EXTRACT_TIMEOUT_MS,
      );
    } catch (err) {
      if (err instanceof TimeoutError) {
        throw new ExternalServiceError('Convention extraction timed out');
      }
      throw new ExternalServiceError(
        `Convention extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }

    const existingHashes = await this.repo.ruleHashes(repoId);
    const extracted: ExtractedCandidate[] = res.data.candidates.map((c) => ({
      category: c.category,
      rule: c.rule,
      applies_to: c.applies_to,
      evidence: c.evidence,
      also_seen_in: c.also_seen_in,
      confidence: c.confidence,
    }));

    const verified = verifyCandidates({ candidates: extracted, samples, existingRuleHashes: existingHashes });

    const insertRows: InsertConvention[] = verified.kept.map((v) => ({
      workspaceId,
      repoId,
      rule: v.rule,
      ruleHash: v.ruleHash,
      category: v.category,
      appliesTo: v.appliesTo,
      evidencePath: v.evidencePath,
      evidenceLine: v.evidenceLine,
      evidenceSnippet: v.evidenceSnippet,
      confidence: v.confidence,
      status: 'pending' as const,
    }));

    const candidates = await this.repo.replacePending(workspaceId, repoId, insertRows);

    const scan = {
      repo_id: repoId,
      sampled_files: samples.files.length,
      proposed: extracted.length,
      verified: verified.kept.length,
      dropped: verified.dropped,
      provider,
      model,
      created_at: new Date().toISOString(),
    };

    log?.info({
      msg: 'conventions.extract',
      repoId,
      sampledFiles: samples.files.length,
      proposed: extracted.length,
      verified: verified.kept.length,
      dropped: verified.dropped,
      model,
      promptVersion: PROMPT_VERSION,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      costUsd: res.costUsd,
      degraded: samples.degraded,
    });

    return { scan, candidates: candidates.map(rowToDto) };
  }

  async list(workspaceId: string, repoId: string, status?: ConventionStatus) {
    const repoRow = await this.repo.getRepo(workspaceId, repoId);
    if (!repoRow) throw new NotFoundError('Repository not found');

    const candidates = await this.repo.list(workspaceId, repoId, status);

    const lastCandidate = candidates.length > 0
      ? candidates.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
      : null;

    const lastScan = lastCandidate
      ? {
          repo_id: repoId,
          sampled_files: 0,
          proposed: 0,
          verified: candidates.filter((c) => c.createdAt.getTime() === lastCandidate.createdAt.getTime()).length,
          dropped: {},
          provider: 'openai' as const,
          model: 'unknown',
          created_at: lastCandidate.createdAt.toISOString(),
        }
      : null;

    let indexState: { status: string; files_indexed: number } | null = null;
    try {
      const state = await this.container.repoIntel.getIndexState(repoId);
      if (state) {
        indexState = { status: state.status, files_indexed: state.filesIndexed ?? 0 };
      }
    } catch {
      // repo-intel may not be enabled
    }

    return {
      candidates: candidates.map(rowToDto),
      last_scan: lastScan,
      index_state: indexState,
    };
  }

  async patch(
    workspaceId: string,
    id: string,
    patch: { rule?: string; category?: ConventionCategory; status?: ConventionStatus },
  ) {
    const row = await this.repo.patch(workspaceId, id, patch);
    if (!row) throw new NotFoundError('Convention not found');
    return rowToDto(row);
  }

  async deleteById(workspaceId: string, id: string) {
    const deleted = await this.repo.deleteById(workspaceId, id);
    if (!deleted) throw new NotFoundError('Convention not found');
    return { ok: true };
  }
}
