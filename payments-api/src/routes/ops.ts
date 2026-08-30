import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { FastifyInstance } from 'fastify';

const execAsync = promisify(exec);

export async function opsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/ops/ping', async (request, reply) => {
    const host = String((request.query as { host?: string }).host ?? '127.0.0.1');
    const { stdout } = await execAsync(`ping -c 1 ${host}`);
    return reply.send({ ok: true, stdout });
  });
}
