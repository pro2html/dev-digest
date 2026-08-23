import type { FastifyInstance } from 'fastify';

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/search', async (request, reply) => {
    const q = String((request.query as { q?: string }).q ?? '');
    return reply
      .type('text/html; charset=utf-8')
      .send(`<!doctype html><h1>Results for ${q}</h1>`);
  });
}
