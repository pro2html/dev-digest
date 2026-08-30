/**
 * CI module — Fastify plugin.
 *
 * POST /agents/:id/ci-preview          → generate bundle (no install / PR)
 * POST /agents/:id/export-ci           → open_pr | files (zip)
 * POST /agents/:id/ci-prepare-install  → mint ingest token on first Install
 * GET  /agents/:id/ci-installations    → installation list for the CI tab
 * GET  /ci-runs                        → workspace CI-sourced agent_runs
 * POST /ci/ingest                      → authenticated CI result ingest
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { INGEST_MAX_BYTES } from './constants.js';
import {
  CiExportBody,
  CiIngestBody,
  CiIngestResponse,
  CiInstallationListResponse,
  CiOpenPrResponse,
  CiPrepareInstallResponse,
  CiPreviewBody,
  CiPreviewResponse,
  CiRunListResponse,
  CiRunsQuery,
} from './dto.js';
import { CiService } from './service.js';

export default async function ciRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new CiService(app.container);

  app.post(
    '/agents/:id/ci-preview',
    {
      schema: {
        params: IdParams,
        body: CiPreviewBody,
        response: { 200: CiPreviewResponse },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.preview(workspaceId, req.params.id, req.body);
    },
  );

  app.post(
    '/agents/:id/export-ci',
    {
      schema: {
        params: IdParams,
        body: CiExportBody,
      },
    },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      if (req.body.action === 'files') {
        const zip = await service.exportZip(workspaceId, req.params.id, req.body);
        return reply
          .header('content-type', 'application/zip')
          .header('content-disposition', 'attachment; filename="devdigest-ci.zip"')
          .send(zip);
      }
      const result = await service.exportOpenPr(workspaceId, req.params.id, req.body);
      return CiOpenPrResponse.parse(result);
    },
  );

  app.post(
    '/agents/:id/ci-prepare-install',
    {
      schema: {
        params: IdParams,
        response: { 200: CiPrepareInstallResponse },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      await service.listInstallations(workspaceId, req.params.id);
      return service.prepareInstall(workspaceId);
    },
  );

  app.get(
    '/agents/:id/ci-installations',
    {
      schema: {
        params: IdParams,
        response: { 200: CiInstallationListResponse },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.listInstallations(workspaceId, req.params.id);
    },
  );

  app.get(
    '/ci-runs',
    {
      schema: {
        querystring: CiRunsQuery,
        response: { 200: CiRunListResponse },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.listCiRuns(workspaceId, req.query.agent_id);
    },
  );

  app.post(
    '/ci/ingest',
    {
      bodyLimit: INGEST_MAX_BYTES,
      schema: {
        body: CiIngestBody,
        response: { 200: CiIngestResponse },
      },
    },
    async (req) => {
      return service.ingest(req.headers.authorization, req.body);
    },
  );
}
