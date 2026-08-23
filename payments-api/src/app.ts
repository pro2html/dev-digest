import Fastify from 'fastify';
import { Pool } from 'pg';
import { accountRoutes } from './routes/accounts.js';
import { chargeRoutes } from './routes/charges.js';
import { exportRoutes } from './routes/exports.js';
import { opsRoutes } from './routes/ops.js';
import { previewRoutes } from './routes/previews.js';
import { searchRoutes } from './routes/search.js';
import { sessionRoutes } from './routes/session.js';
import { userRoutes } from './routes/users.js';

const app = Fastify({ logger: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

await app.register(chargeRoutes);
await app.register(async (instance) => userRoutes(instance, pool));
await app.register(opsRoutes);
await app.register(previewRoutes);
await app.register(searchRoutes);
await app.register(exportRoutes);
await app.register(sessionRoutes);
await app.register(async (instance) => accountRoutes(instance, pool));

await app.listen({ port: Number(process.env.PORT ?? 8080), host: '0.0.0.0' });
