import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const EXPORTS_ROOT = '/var/payments/exports';

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/exports/:fileName', async (request, reply) => {
    const { fileName } = request.params as { fileName: string };
    const body = await readFile(path.join(EXPORTS_ROOT, fileName), 'utf8');
    return reply.type('application/octet-stream').send(body);
  });
}
