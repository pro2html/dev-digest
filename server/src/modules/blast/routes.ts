/**
 * Blast module — Fastify plugin.
 *
 * GET /pulls/:id/blast → PrBlastRecord (compute-on-read, no LLM)
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PrBlastRecord } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { BlastService } from './service.js';

export default async function blastRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new BlastService(app.container);

  app.get(
    '/pulls/:id/blast',
    {
      schema: {
        params: IdParams,
        response: { 200: PrBlastRecord },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.getBlast(workspaceId, id);
    },
  );
}
