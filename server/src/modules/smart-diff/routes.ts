/**
 * Smart Diff module — Fastify plugin.
 *
 * GET /pulls/:id/smart-diff → SmartDiffResponse (compute-on-read, no LLM)
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { SmartDiffResponse } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { SmartDiffService } from './service.js';

export default async function smartDiffRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SmartDiffService(app.container);

  app.get(
    '/pulls/:id/smart-diff',
    {
      schema: {
        params: IdParams,
        response: { 200: SmartDiffResponse },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.getSmartDiff(workspaceId, id);
    },
  );
}
