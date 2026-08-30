/**
 * Multi-agent review — Fastify plugin.
 *
 * POST /pulls/:id/multi-agent-run → parent + N children via ReviewService
 * GET  /pulls/:id/multi-agent      → latest parent or { run: null }
 * GET  /pulls/:id/multi-agent-runs → all parents for the PR timeline
 * GET  /multi-agent-runs/:id       → one parent
 * GET  /agents/review-estimates    → past completed-run averages
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { MultiAgentRun, MultiAgentStartRequest } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { AgentReviewEstimates, MultiAgentGetEnvelope, MultiAgentListEnvelope } from './dto.js';
import { MultiAgentService } from './service.js';

function startRateKey(req: FastifyRequest): string {
  const id = (req.params as { id?: string }).id ?? 'unknown';
  return `multi-agent-run:${id}`;
}

export default async function multiAgentRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new MultiAgentService(app.container);

  app.post(
    '/pulls/:id/multi-agent-run',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          keyGenerator: startRateKey,
        },
      },
      schema: {
        params: IdParams,
        body: MultiAgentStartRequest,
        response: { 200: MultiAgentRun },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.start(workspaceId, id, req.body.agent_ids, req.log);
    },
  );

  app.get(
    '/pulls/:id/multi-agent',
    {
      schema: {
        params: IdParams,
        response: { 200: MultiAgentGetEnvelope },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.getLatest(workspaceId, id);
    },
  );

  app.get(
    '/pulls/:id/multi-agent-runs',
    {
      schema: {
        params: IdParams,
        response: { 200: MultiAgentListEnvelope },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.listForPull(workspaceId, id);
    },
  );

  app.get(
    '/multi-agent-runs/:id',
    {
      schema: {
        params: IdParams,
        response: { 200: MultiAgentGetEnvelope },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.getById(workspaceId, id);
    },
  );

  app.get(
    '/agents/review-estimates',
    {
      schema: {
        response: { 200: AgentReviewEstimates },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.estimates(workspaceId);
    },
  );
}
