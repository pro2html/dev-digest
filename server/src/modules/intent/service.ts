/**
 * Intent Layer — derive / ensure / get.
 * Cheap flash model via resolveFeatureModel(..., 'review_intent').
 * Fail-open on ensureForReview so Run Review is never blocked.
 */
import type { Intent, IssueMeta, PrIntentRecord } from '@devdigest/shared';
import { wrapUntrusted } from '@devdigest/reviewer-core';
import type { Container } from '../../platform/container.js';
import type { PrIntentMeta } from '../../db/schema/reviews.js';
import { ExternalServiceError, NotFoundError } from '../../platform/errors.js';
import { withTimeout, TimeoutError } from '../../platform/resilience.js';
import { renderPrompt } from '../../platform/prompts.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { IntentRepository } from './repository.js';
import { IntentClassification } from './llm-schema.js';
import { buildIntentSources, type IntentSourcesMeta } from './sources.js';
import { CLASSIFY_TIMEOUT_MS, PROMPT_NAME, PROMPT_VERSION } from './constants.js';

export type IntentDeriveResult = PrIntentRecord & {
  _meta?: IntentSourcesMeta;
  provider?: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
};

export type EnsureIntentResult = {
  intent: Intent | null;
  derived: boolean;
  failed: boolean;
  record?: PrIntentRecord;
  meta?: IntentSourcesMeta;
  provider?: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
  error?: string;
};

function metaToSources(meta: IntentSourcesMeta | PrIntentMeta | null | undefined): IntentSourcesMeta | undefined {
  if (!meta) return undefined;
  return {
    context_quality: meta.context_quality,
    missing: meta.missing,
    sources: meta.sources,
    body_len: 'body_len' in meta && typeof meta.body_len === 'number' ? meta.body_len : 0,
    files_n: 'files_n' in meta && typeof meta.files_n === 'number' ? meta.files_n : 0,
    hunk_headers_n:
      'hunk_headers_n' in meta && typeof meta.hunk_headers_n === 'number' ? meta.hunk_headers_n : 0,
  };
}

function toRecord(
  prId: string,
  intent: Intent,
  meta?: IntentSourcesMeta | PrIntentMeta | null,
): PrIntentRecord {
  return {
    pr_id: prId,
    intent: intent.intent,
    in_scope: intent.in_scope,
    out_of_scope: intent.out_of_scope,
    context_quality: meta?.context_quality ?? null,
    missing_context: meta?.missing ?? null,
    sources: meta?.sources ?? null,
    stale: false,
  };
}

function toPersistedMeta(meta: IntentSourcesMeta): PrIntentMeta {
  return {
    context_quality: meta.context_quality,
    missing: meta.missing,
    sources: meta.sources,
    body_len: meta.body_len,
    files_n: meta.files_n,
    hunk_headers_n: meta.hunk_headers_n,
  };
}

export class IntentService {
  private repo: IntentRepository;

  constructor(private container: Container) {
    this.repo = new IntentRepository(container.db);
  }

  async get(workspaceId: string, prId: string): Promise<PrIntentRecord | null> {
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const row = await this.repo.getIntent(prId);
    if (!row) return null;
    return toRecord(prId, row.intent, row.meta);
  }

  /**
   * Derive (or re-derive) intent for a PR, persist, and return the transport record.
   */
  async derive(workspaceId: string, prId: string, log?: {
    info: (obj: unknown, msg?: string) => void;
    warn?: (obj: unknown, msg?: string) => void;
  }): Promise<IntentDeriveResult> {
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const repo = await this.repo.getRepo(pull.repoId);
    if (!repo) throw new NotFoundError('Repository not found');

    const files = await this.repo.getPrFiles(prId);
    const linkedIssue = await this.fetchLinkedIssueBestEffort(repo.owner, repo.name, pull.number, pull.body);

    const bundle = await buildIntentSources({
      title: pull.title,
      body: pull.body,
      linkedIssue,
      files: files.map((f) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      })),
      clonePath: repo.clonePath,
    });

    log?.info?.(
      {
        msg: 'intent.sources',
        prId,
        body_len: bundle.meta.body_len,
        has_issue: bundle.meta.sources.linked_issue,
        has_spec: bundle.meta.sources.plan_spec,
        files_n: bundle.meta.files_n,
        hunk_headers_n: bundle.meta.hunk_headers_n,
        missing: bundle.meta.missing,
        quality: bundle.meta.context_quality,
      },
      'intent.sources',
    );

    const { provider, model } = await resolveFeatureModel(this.container, workspaceId, 'review_intent');
    const llm = await this.container.llm(provider);
    const system = await renderPrompt(PROMPT_NAME, {});

    const started = Date.now();
    let res: {
      data: IntentClassification;
      tokensIn: number;
      tokensOut: number;
    };
    try {
      res = await withTimeout(
        llm.completeStructured<IntentClassification>({
          model,
          schema: IntentClassification,
          schemaName: 'IntentClassification',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: wrapUntrusted('pr-intent-sources', bundle.text) },
          ],
          temperature: 0,
          maxRetries: 2,
        }),
        CLASSIFY_TIMEOUT_MS,
      );
    } catch (err) {
      log?.warn?.(
        { msg: 'intent.failed', prId, err: err instanceof Error ? err.message : 'unknown' },
        'intent.failed',
      );
      if (err instanceof TimeoutError) {
        throw new ExternalServiceError('Intent classification timed out');
      }
      throw new ExternalServiceError(
        `Intent classification failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
    const latency_ms = Date.now() - started;

    const quality = bundle.meta.context_quality;
    const missing = [
      ...new Set([...(bundle.meta.missing), ...(res.data.missing_context ?? [])]),
    ];

    const intent: Intent = {
      intent: res.data.intent,
      in_scope: res.data.in_scope,
      out_of_scope: res.data.out_of_scope,
    };

    const meta: IntentSourcesMeta = {
      ...bundle.meta,
      context_quality: res.data.context_quality ?? quality,
      missing,
    };

    await this.repo.upsertIntent(prId, intent, toPersistedMeta(meta));

    log?.info?.(
      {
        msg: 'intent.classify',
        prId,
        provider,
        model,
        tokens_in: res.tokensIn,
        tokens_out: res.tokensOut,
        latency_ms,
        promptVersion: PROMPT_VERSION,
      },
      'intent.classify',
    );
    log?.info?.({ msg: 'intent.persisted', prId }, 'intent.persisted');

    return {
      ...toRecord(prId, intent, meta),
      _meta: meta,
      provider,
      model,
      tokens_in: res.tokensIn,
      tokens_out: res.tokensOut,
      latency_ms,
    };
  }

  /**
   * Return existing intent or derive. On classify failure returns null intent
   * (fail-open) so Run Review continues.
   */
  async ensureForReview(workspaceId: string, prId: string, log?: {
    info: (obj: unknown, msg?: string) => void;
    warn?: (obj: unknown, msg?: string) => void;
  }): Promise<EnsureIntentResult> {
    const existing = await this.repo.getIntent(prId);
    if (existing) {
      const sourcesMeta = metaToSources(existing.meta);
      return {
        intent: existing.intent,
        derived: false,
        failed: false,
        record: toRecord(prId, existing.intent, existing.meta),
        meta: sourcesMeta,
      };
    }
    try {
      const derived = await this.derive(workspaceId, prId, log);
      const { _meta, provider, model, tokens_in, tokens_out, latency_ms, ...record } = derived;
      return {
        intent: {
          intent: record.intent,
          in_scope: record.in_scope,
          out_of_scope: record.out_of_scope,
        },
        derived: true,
        failed: false,
        record,
        meta: _meta,
        provider,
        model,
        tokens_in,
        tokens_out,
        latency_ms,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      log?.warn?.({ msg: 'intent.failed', prId, err: message }, 'intent.failed');
      return { intent: null, derived: false, failed: true, error: message };
    }
  }

  private async fetchLinkedIssueBestEffort(
    owner: string,
    name: string,
    prNumber: number,
    body: string | null,
  ): Promise<IssueMeta | null> {
    try {
      const gh = await this.container.github();
      const detail = await gh.getPullRequest({ owner, name }, prNumber);
      if (detail.linked_issue) return detail.linked_issue;
    } catch {
      /* fall through to body-only parse + getIssue */
    }
    const m = (body ?? '').match(/(?:closes|fixes|resolves)?\s*#(\d+)/i);
    if (!m?.[1]) return null;
    try {
      const gh = await this.container.github();
      return await gh.getIssue({ owner, name }, Number(m[1]));
    } catch {
      return null;
    }
  }
}
