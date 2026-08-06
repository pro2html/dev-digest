import type { FastifyInstance } from 'fastify';
import { getUser, listUsers, createUser } from './users';
import { getPost, listPosts, createPost } from './posts';

export default async function routes(app: FastifyInstance) {
  app.get('/users', async (req) => {
    const { workspaceId } = req.context;
    return listUsers(workspaceId);
  });

  app.get('/users/:id', async (req) => {
    const { id } = req.params as { id: string };
    return getUser(id);
  });

  app.post('/users', async (req) => {
    const { workspaceId } = req.context;
    const body = req.body as { name: string; email: string };
    return createUser(workspaceId, body);
  });

  app.get('/posts', async (req) => {
    const { workspaceId } = req.context;
    return listPosts(workspaceId);
  });

  app.post('/posts', async (req) => {
    const { workspaceId } = req.context;
    const body = req.body as { title: string; body: string; authorId: string };
    return createPost(workspaceId, body);
  });
}
