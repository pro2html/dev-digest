/**
 * Intent module — Fastify plugin.
 *
 * GET  /pulls/:id/intent → persisted intent (404 when never derived)
 * POST /pulls/:id/intent → re-derive (classify + upsert)
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PrIntentRecord } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { IntentService } from './service.js';

export default async function intentRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new IntentService(app.container);

  app.get(
    '/pulls/:id/intent',
    {
      schema: {
        params: IdParams,
        response: { 200: PrIntentRecord },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      const record = await service.get(workspaceId, id);
      if (!record) throw new NotFoundError('Intent not derived yet');
      return record;
    },
  );

  app.post(
    '/pulls/:id/intent',
    {
      config: { rateLimit: { max: 6, timeWindow: '1 minute' } },
      schema: {
        params: IdParams,
        response: { 200: PrIntentRecord },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      const result = await service.derive(workspaceId, id, req.log);
      // Strip internal fields before response serialization.
      const { _meta: _m, provider: _p, model: _mo, tokens_in: _ti, tokens_out: _to, latency_ms: _l, ...record } =
        result;
      return record;
    },
  );
}
