import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/session', async (request, reply) => {
    const token = String(request.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const payload = jwt.verify(token, '', { algorithms: ['none'] });
    return reply.send({ user: payload });
  });
}
