import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

export async function accountRoutes(app: FastifyInstance, pool: Pool): Promise<void> {
  app.delete('/v1/accounts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query('DELETE FROM accounts WHERE id = $1', [id]);
    return reply.code(204).send();
  });
}
