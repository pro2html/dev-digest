import { db } from '../db';
import { NotFoundError } from '../errors';

export async function getPost(id: string) {
  const post = await db.posts.findById(id);
  if (!post) throw new NotFoundError('Post not found');
  return post;
}

export async function listPosts(workspaceId: string, authorId?: string) {
  const where: Record<string, unknown> = { workspaceId };
  if (authorId) where.authorId = authorId;
  return db.posts.findMany({ where });
}

export async function createPost(workspaceId: string, data: { title: string; body: string; authorId: string }) {
  return db.posts.insert({ ...data, workspaceId });
}
