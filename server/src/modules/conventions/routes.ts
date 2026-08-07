/**
 * Conventions module — Fastify plugin.
 *
 * POST /repos/:id/conventions/extract    → run extraction
 * GET  /repos/:id/conventions            → list candidates
 * PATCH /conventions/:id                 → accept/reject/edit
 * DELETE /conventions/:id                → delete
 * POST /repos/:id/conventions/skill-draft → preview composed skill body
 * POST /repos/:id/conventions/skill      → create skill from accepted candidates
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ConventionCategory, ConventionStatus, SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import { ConventionsService } from './service.js';
import { ComposerService } from './composer.js';

const RepoIdParams = z.object({ id: z.string().uuid() });

const PatchBody = z
  .object({
    rule: z.string().min(1).optional(),
    category: ConventionCategory.optional(),
    status: ConventionStatus.optional(),
  })
  .refine((b) => b.rule || b.category || b.status, {
    message: 'At least one field (rule, category, status) is required',
  });

const SkillDraftBody = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

const CreateSkillBody = z.object({
  ids: z.array(z.string().uuid()).min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: SkillType.optional(),
  body: z.string().min(1),
  enabled: z.boolean().optional(),
  agent_id: z.string().uuid().optional(),
});

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);
  const composer = new ComposerService(app.container);

  app.post(
    '/repos/:id/conventions/extract',
    {
      config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
      schema: { params: RepoIdParams },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id: repoId } = req.params as z.infer<typeof RepoIdParams>;
      return service.extract(workspaceId, repoId, req.log);
    },
  );

  app.get(
    '/repos/:id/conventions',
    { schema: { params: RepoIdParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id: repoId } = req.params as z.infer<typeof RepoIdParams>;
      const status = (req.query as { status?: string }).status as ConventionStatus | undefined;
      return service.list(workspaceId, repoId, status);
    },
  );

  app.patch(
    '/conventions/:id',
    { schema: { params: IdParams, body: PatchBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as z.infer<typeof IdParams>;
      const body = req.body as z.infer<typeof PatchBody>;
      return service.patch(workspaceId, id, body);
    },
  );

  app.delete(
    '/conventions/:id',
    { schema: { params: IdParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as z.infer<typeof IdParams>;
      return service.deleteById(workspaceId, id);
    },
  );

  app.post(
    '/repos/:id/conventions/skill-draft',
    { schema: { params: RepoIdParams, body: SkillDraftBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id: repoId } = req.params as z.infer<typeof RepoIdParams>;
      const { ids } = req.body as z.infer<typeof SkillDraftBody>;
      return composer.draft(workspaceId, repoId, ids);
    },
  );

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: RepoIdParams, body: CreateSkillBody } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id: repoId } = req.params as z.infer<typeof RepoIdParams>;
      const body = req.body as z.infer<typeof CreateSkillBody>;
      const skill = await composer.createSkill(workspaceId, repoId, body);
      return reply.status(201).send(skill);
    },
  );
}
