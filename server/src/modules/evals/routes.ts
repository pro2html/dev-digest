/**
 * Evals module — Fastify plugin.
 *
 * Case CRUD, one-click creation from findings, single-case + whole-set runs,
 * history, compare, owner/workspace dashboards.
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  EvalCaseInput,
  EvalCaseListItem,
  EvalCaseFromFinding,
  EvalCaseFromFindingInput,
  EvalOwnerDashboard,
  EvalOwnerKind,
  EvalRunAllAgentsResult,
  EvalRunComparison,
  EvalRunResult,
  EvalSetRun,
  EvalWorkspaceDashboard,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { EvalsService } from './service.js';

const OwnerParams = z.object({
  ownerKind: EvalOwnerKind,
  ownerId: z.string().uuid(),
});

const CompareQuery = z.object({
  a: z.string().uuid(),
  b: z.string().uuid(),
});

const StartSetBody = z.object({
  agent_id: z.string().uuid().optional(),
});

export default async function evalsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new EvalsService(app.container);

  app.get(
    '/evals/owners/:ownerKind/:ownerId/cases',
    { schema: { params: OwnerParams, response: { 200: z.array(EvalCaseListItem) } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { ownerKind, ownerId } = req.params;
      return service.listCases(workspaceId, ownerKind, ownerId);
    },
  );

  app.post(
    '/evals/owners/:ownerKind/:ownerId/cases',
    { schema: { params: OwnerParams, body: EvalCaseInput, response: { 200: EvalCaseListItem } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { ownerKind, ownerId } = req.params;
      return service.createCase(workspaceId, ownerKind, ownerId, req.body);
    },
  );

  app.get(
    '/evals/cases/:id',
    { schema: { params: IdParams, response: { 200: EvalCaseListItem } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.getCase(workspaceId, req.params.id);
    },
  );

  app.patch(
    '/evals/cases/:id',
    { schema: { params: IdParams, body: EvalCaseInput, response: { 200: EvalCaseListItem } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.updateCase(workspaceId, req.params.id, req.body);
    },
  );

  app.delete(
    '/evals/cases/:id',
    { schema: { params: IdParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      await service.deleteCase(workspaceId, req.params.id);
      return { ok: true };
    },
  );

  app.post(
    '/evals/cases/:id/run',
    { schema: { params: IdParams, response: { 200: EvalRunResult } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.runCase(workspaceId, req.params.id);
    },
  );

  app.post(
    '/evals/owners/:ownerKind/:ownerId/runs',
    { schema: { params: OwnerParams, body: StartSetBody, response: { 200: EvalSetRun } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { ownerKind, ownerId } = req.params;
      return service.startSetRun(workspaceId, ownerKind, ownerId, req.body ?? {});
    },
  );

  app.get(
    '/evals/owners/:ownerKind/:ownerId/runs',
    { schema: { params: OwnerParams, response: { 200: z.array(EvalSetRun) } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { ownerKind, ownerId } = req.params;
      return service.history(workspaceId, ownerKind, ownerId);
    },
  );

  app.get(
    '/evals/owners/:ownerKind/:ownerId/dashboard',
    { schema: { params: OwnerParams, response: { 200: EvalOwnerDashboard } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { ownerKind, ownerId } = req.params;
      return service.ownerDashboard(workspaceId, ownerKind, ownerId);
    },
  );

  app.get(
    '/evals/owners/:ownerKind/:ownerId/compare',
    { schema: { params: OwnerParams, querystring: CompareQuery, response: { 200: EvalRunComparison } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.compare(workspaceId, req.query.a, req.query.b);
    },
  );

  app.get(
    '/evals/set-runs/:id',
    { schema: { params: IdParams, response: { 200: EvalSetRun } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.getSetRun(workspaceId, req.params.id);
    },
  );

  app.post(
    '/evals/set-runs/:id/cancel',
    { schema: { params: IdParams, response: { 200: EvalSetRun } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.cancelSetRun(workspaceId, req.params.id);
    },
  );

  app.get(
    '/evals/dashboard',
    { schema: { response: { 200: EvalWorkspaceDashboard } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.workspaceDashboard(workspaceId);
    },
  );

  app.post(
    '/evals/run-all-agents',
    { schema: { response: { 200: EvalRunAllAgentsResult } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.runAllAgents(workspaceId);
    },
  );

  app.post(
    '/findings/:id/eval-case',
    {
      schema: {
        params: IdParams,
        // inject()/api.post without a body arrives as null/undefined — `.default({})`
        // only substitutes `undefined`, so preprocess empty to `{}` first.
        body: z.preprocess((v) => (v == null ? {} : v), EvalCaseFromFindingInput),
        response: { 200: EvalCaseListItem },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.createCaseFromFinding(workspaceId, req.params.id, req.body);
    },
  );

  app.get(
    '/findings/:id/eval-case',
    { schema: { params: IdParams, response: { 200: EvalCaseFromFinding } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.previewCaseFromFinding(workspaceId, req.params.id);
    },
  );
}
