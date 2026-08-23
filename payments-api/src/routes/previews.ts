import type { FastifyInstance } from 'fastify';

export async function previewRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/previews', async (request, reply) => {
    const url = String((request.query as { url?: string }).url ?? '');
    const upstream = await fetch(url);
    const html = await upstream.text();
    return reply.type('text/html').send(html);
  });
}
