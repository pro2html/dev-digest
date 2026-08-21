/**
 * Why+Risk Brief module — Fastify plugin.
 *
 * GET  /pulls/:id/brief → cached envelope (brief: null when never generated)
 * POST /pulls/:id/brief → generate / regenerate (rate-limited; always rebuilds)
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { WhyRiskBriefRecord } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { BriefService } from './service.js';

function generateRateKey(req: FastifyRequest): string {
  const id = (req.params as { id?: string }).id ?? 'unknown';
  return `brief-generate:${id}`;
}

export default async function briefRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new BriefService(app.container);

  app.get(
    '/pulls/:id/brief',
    {
      schema: {
        params: IdParams,
        response: { 200: WhyRiskBriefRecord },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.get(workspaceId, id);
    },
  );

  app.post(
    '/pulls/:id/brief',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 minute',
          keyGenerator: generateRateKey,
        },
      },
      schema: {
        params: IdParams,
        response: { 200: WhyRiskBriefRecord },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.generate(workspaceId, id, req.log);
    },
  );
}
