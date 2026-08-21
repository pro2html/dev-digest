/**
 * Onboarding module — Fastify plugin.
 *
 * GET  /repos/:id/onboarding              → current tour envelope (empty if none)
 * POST /repos/:id/onboarding/generate     → generate / regenerate (rate-limited)
 * GET  /repos/:id/onboarding/file?path=   → read-only clone preview for Open
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { OnboardingTour } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { OnboardingService } from './service.js';

const FileQuery = z.object({ path: z.string().min(1) });

const FilePreview = z.object({
  path: z.string(),
  content: z.string(),
});

function generateRateKey(req: FastifyRequest): string {
  const id = (req.params as { id?: string }).id ?? 'unknown';
  return `onboarding-generate:${id}`;
}

export default async function onboardingRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new OnboardingService(app.container);

  app.get(
    '/repos/:id/onboarding',
    {
      schema: {
        params: IdParams,
        response: { 200: OnboardingTour },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.getTour(workspaceId, id);
    },
  );

  app.post(
    '/repos/:id/onboarding/generate',
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
        response: { 200: OnboardingTour },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.generate(workspaceId, id, req.log);
    },
  );

  app.get(
    '/repos/:id/onboarding/file',
    {
      schema: {
        params: IdParams,
        querystring: FileQuery,
        response: { 200: FilePreview },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      const { path } = req.query as z.infer<typeof FileQuery>;
      return service.previewFile(workspaceId, id, path);
    },
  );
}
