import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { AppError } from '../src/platform/errors.js';
import type { Container } from '../src/platform/container.js';
import { CiService } from '../src/modules/ci/service.js';
import {
  ERR_INGEST_UNAUTHORIZED,
  ERR_INVALID_REPO,
  ERR_UNSUPPORTED_TARGET,
} from '../src/modules/ci/constants.js';
import type { CiIngestBody, CiPreviewBody } from '../src/modules/ci/dto.js';

const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

const PREVIEW: CiPreviewBody = {
  repo: 'acme/payments-api',
  target: 'gha',
  post_as: 'github_review',
  triggers: ['opened', 'synchronize'],
  base: 'main',
};

const INGEST: CiIngestBody = {
  findings_count: 1,
  critical: 1,
  warning: 0,
  suggestion: 0,
  cost_usd: 0.01,
  duration_ms: 900,
  agent: 'Security Reviewer',
  version: '1',
  pr_number: 12,
  job_url: 'https://github.com/acme/payments-api/actions/runs/99',
  commit_sha: 'abc1234',
  model: 'gpt-4.1',
  manifest_version: '1',
  tool_versions: { runner: 'devdigest-bundled' },
  verdict: 'fail',
  repo: 'acme/payments-api',
  status: 'succeeded',
};

function service(): CiService {
  return new CiService({ db: {} } as unknown as Container);
}

describe('CiService validation (no DB)', () => {
  it('rejects a non-gha target before generating files (AC-50)', async () => {
    await expect(service().preview('ws', 'ag', { ...PREVIEW, target: 'circle' })).rejects.toMatchObject({
      name: 'AppError',
      code: ERR_UNSUPPORTED_TARGET,
      statusCode: 422,
    });
    await expect(service().preview('ws', 'ag', { ...PREVIEW, target: 'jenkins' })).rejects.toMatchObject({
      code: ERR_UNSUPPORTED_TARGET,
    });
    await expect(service().preview('ws', 'ag', { ...PREVIEW, target: 'cli' })).rejects.toMatchObject({
      code: ERR_UNSUPPORTED_TARGET,
    });
  });

  it('rejects empty or invalid owner/name before generating files (AC-13)', async () => {
    await expect(service().preview('ws', 'ag', { ...PREVIEW, repo: '../evil/name' })).rejects.toMatchObject({
      name: 'AppError',
      code: ERR_INVALID_REPO,
      statusCode: 422,
    });
    await expect(
      service().preview('ws', 'ag', { ...PREVIEW, repo: 'https://github.com/acme/api' }),
    ).rejects.toMatchObject({ code: ERR_INVALID_REPO });
    await expect(service().exportZip('ws', 'ag', { ...PREVIEW, action: 'files', repo: 'acme/..' })).rejects.toMatchObject(
      { code: ERR_INVALID_REPO },
    );
  });

  it('rejects ingest without a bearer token and does not persist a run (AC-45)', async () => {
    await expect(service().ingest(undefined, INGEST)).rejects.toBeInstanceOf(AppError);
    await expect(service().ingest(undefined, INGEST)).rejects.toMatchObject({
      code: ERR_INGEST_UNAUTHORIZED,
      statusCode: 401,
    });
    await expect(service().ingest('Basic abc', INGEST)).rejects.toMatchObject({
      code: ERR_INGEST_UNAUTHORIZED,
    });
  });
});

describe('POST /ci/ingest (no DB)', () => {
  it('returns 401 ingest_unauthorized when Authorization is missing (AC-45)', async () => {
    const app = await buildApp({ config });
    const res = await app.inject({ method: 'POST', url: '/ci/ingest', payload: INGEST });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe(ERR_INGEST_UNAUTHORIZED);
    await app.close();
  });
});
