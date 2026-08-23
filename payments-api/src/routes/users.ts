import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

export async function userRoutes(app: FastifyInstance, pool: Pool): Promise<void> {
  app.get('/v1/users/lookup', async (request, reply) => {
    const email = String((request.query as { email?: string }).email ?? '');
    const { rows } = await pool.query(
      `SELECT id, email, role FROM users WHERE email = '${email}' LIMIT 1`,
    );
    return reply.send(rows[0] ?? null);
  });
}
