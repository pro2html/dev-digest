/**
 * Project-context module — Fastify plugin.
 *
 * GET  /repos/:id/context              → catalog (live clone scan)
 * GET  /repos/:id/context/file?path=   → one SpecFile with content
 * POST /repos/:id/context/files        → write markdown under docs/imported-context/
 * GET  /agents/:id/context             → attachment list
 * PUT  /agents/:id/context?repoId=     → replace-full-list
 * GET  /skills/:id/context             → attachment list
 * PUT  /skills/:id/context?repoId=     → replace-full-list
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AgentContextList,
  ContextCatalogFile,
  ContextImportFile,
  SkillContextList,
  SpecFile,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { ProjectContextService } from './service.js';

const FileQuery = z.object({ path: z.string().min(1) });
const RepoQuery = z.object({ repoId: z.string().uuid() });

export default async function projectContextRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ProjectContextService(app.container);

  app.get(
    '/repos/:id/context/file',
    {
      schema: {
        params: IdParams,
        querystring: FileQuery,
        response: { 200: SpecFile },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      const { path } = req.query as z.infer<typeof FileQuery>;
      return service.previewFile(workspaceId, id, path);
    },
  );

  app.get(
    '/repos/:id/context',
    {
      schema: {
        params: IdParams,
        response: { 200: z.array(ContextCatalogFile) },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.listCatalog(workspaceId, id);
    },
  );

  app.post(
    '/repos/:id/context/files',
    {
      schema: {
        params: IdParams,
        body: ContextImportFile,
        response: { 201: ContextCatalogFile },
      },
    },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      const { filename, content } = req.body as ContextImportFile;
      const row = await service.importFile(workspaceId, id, filename, content);
      return reply.code(201).send(row);
    },
  );

  app.get(
    '/agents/:id/context',
    {
      schema: {
        params: IdParams,
        response: { 200: AgentContextList },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.getAgentContext(workspaceId, id);
    },
  );

  app.put(
    '/agents/:id/context',
    {
      schema: {
        params: IdParams,
        querystring: RepoQuery,
        body: AgentContextList,
        response: { 200: AgentContextList },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      const { repoId } = req.query as z.infer<typeof RepoQuery>;
      const body = req.body as AgentContextList;
      return service.putAgentContext(workspaceId, id, repoId, body.documents);
    },
  );

  app.get(
    '/skills/:id/context',
    {
      schema: {
        params: IdParams,
        response: { 200: SkillContextList },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      return service.getSkillContext(workspaceId, id);
    },
  );

  app.put(
    '/skills/:id/context',
    {
      schema: {
        params: IdParams,
        querystring: RepoQuery,
        body: SkillContextList,
        response: { 200: SkillContextList },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { id } = req.params as IdParams;
      const { repoId } = req.query as z.infer<typeof RepoQuery>;
      const body = req.body as SkillContextList;
      return service.putSkillContext(workspaceId, id, repoId, body.documents);
    },
  );
}
