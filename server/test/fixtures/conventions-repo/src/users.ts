import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { NotFoundError } from '../errors';

export async function getUser(id: string) {
  const user = await db.users.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function listUsers(workspaceId: string) {
  return db.users.findMany({ where: { workspaceId } });
}

export async function createUser(workspaceId: string, data: { name: string; email: string }) {
  return db.users.insert({ ...data, workspaceId });
}
