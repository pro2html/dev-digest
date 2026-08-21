/**
 * Why+Risk Brief — generate, read cache. GET never writes. POST always rebuilds.
 */
import type { Intent, PrIntentRecord, WhyRiskBriefRecord } from '@devdigest/shared';
import { wrapUntrusted } from '@devdigest/reviewer-core';
import type { Container } from '../../platform/container.js';
import { AppError, ExternalServiceError, NotFoundError } from '../../platform/errors.js';
import { TimeoutError, withTimeout } from '../../platform/resilience.js';
import { renderPrompt } from '../../platform/prompts.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { IntentService } from '../intent/service.js';
import { BlastService } from '../blast/service.js';
import { EXTRACT_TIMEOUT_MS, GENERATION_FAILED_CODE, PROMPT_NAME } from './constants.js';
import { collectFacts, fetchLinkedIssueBestEffort } from './facts.js';
import { groundBrief } from './ground.js';
import { WhyRiskLlmOutput } from './llm-schema.js';
import { emptyRecord, fromBrief, toRecord } from './mapper.js';
import { BriefRepository } from './repository.js';

function generationFailed(message: string): AppError {
  return new AppError(GENERATION_FAILED_CODE, message, 502);
}

function asIntent(record: PrIntentRecord): Intent {
  return {
    intent: record.intent,
    in_scope: record.in_scope,
    out_of_scope: record.out_of_scope,
  };
}

export class BriefService {
  private repo: BriefRepository;
  private intent: IntentService;
  private blast: BlastService;

  constructor(private container: Container) {
    this.repo = new BriefRepository(container.db);
    this.intent = new IntentService(container);
    this.blast = new BlastService(container);
  }

  async get(workspaceId: string, prId: string): Promise<WhyRiskBriefRecord> {
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const stored = await this.repo.getByPrId(prId);
    if (!stored) return emptyRecord(prId);
    return toRecord(prId, stored, pull.headSha);
  }

  async generate(
    workspaceId: string,
    prId: string,
    log?: { info: (obj: unknown) => void; warn?: (obj: unknown) => void },
  ): Promise<WhyRiskBriefRecord> {
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const repoRow = await this.repo.getRepo(pull.repoId);
    if (!repoRow) throw new NotFoundError('Repository not found');

    const generateSha = pull.headSha;
    const files = await this.repo.getPrFiles(prId);

    const intentRecord = await this.requireIntent(workspaceId, prId, log);
    const blast = await this.blast.getBlast(workspaceId, prId);

    const issue = await this.linkedIssueOrOmit(repoRow.owner, repoRow.name, pull.number, pull.body);

    const facts = await collectFacts({
      intent: asIntent(intentRecord),
      blast,
      files: files.map((f) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
      })),
      issue,
      prBody: pull.body,
      clonePath: repoRow.clonePath,
    });

    const { provider, model } = await resolveFeatureModel(this.container, workspaceId, 'risk_brief');
    const llm = await this.container.llm(provider);
    const system = await renderPrompt(PROMPT_NAME, {});
    const user = wrapUntrusted('risk-brief-facts', facts.block);

    let data: WhyRiskLlmOutput;
    try {
      const res = await withTimeout(
        llm.completeStructured<WhyRiskLlmOutput>({
          model,
          schema: WhyRiskLlmOutput,
          schemaName: 'WhyRiskBriefWrite',
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
        msg: 'brief.generate.model',
        prId,
        model,
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
      });
    } catch (err) {
      if (err instanceof TimeoutError) {
        throw generationFailed('Why+Risk Brief generation timed out');
      }
      if (err instanceof AppError) throw err;
      throw generationFailed(
        `Why+Risk Brief generation failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }

    const grounded = groundBrief(data, {
      changedPaths: facts.changedPaths,
      blastEndpoints: facts.blastEndpoints,
      pullTitle: pull.title,
    });
    if (!grounded.ok) {
      throw generationFailed(`Why+Risk Brief generation failed: ${grounded.reason}`);
    }

    const stored = await this.repo.upsert(prId, fromBrief(grounded.brief, generateSha));
    const latest = await this.repo.getPull(workspaceId, prId);
    return toRecord(prId, stored, latest?.headSha ?? generateSha);
  }

  /**
   * Stored Intent, else L03 derive. Derive failure → generation_failed.
   * Do not use fail-open `ensureForReview`.
   */
  private async requireIntent(
    workspaceId: string,
    prId: string,
    log?: { info: (obj: unknown) => void; warn?: (obj: unknown) => void },
  ): Promise<PrIntentRecord> {
    const existing = await this.intent.get(workspaceId, prId);
    if (existing) return existing;
    try {
      const derived = await this.intent.derive(workspaceId, prId, log);
      const { _meta: _m, provider: _p, model: _mo, tokens_in: _ti, tokens_out: _to, latency_ms: _l, ...record } =
        derived;
      return record;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      const message = err instanceof ExternalServiceError ? err.message : err instanceof Error ? err.message : 'unknown';
      throw generationFailed(`Intent derive failed: ${message}`);
    }
  }

  private async linkedIssueOrOmit(
    owner: string,
    name: string,
    prNumber: number,
    body: string | null,
  ): Promise<Awaited<ReturnType<typeof fetchLinkedIssueBestEffort>>> {
    try {
      const gh = await this.container.github();
      return await fetchLinkedIssueBestEffort(gh, owner, name, prNumber, body);
    } catch {
      return null;
    }
  }
}
