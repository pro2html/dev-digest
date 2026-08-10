import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createDevDigestMcp, type CreateDevDigestMcpOptions } from '../src/server.js';

export async function withMcpClient(opts: CreateDevDigestMcpOptions = {}) {
  const { server } = createDevDigestMcp(opts);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    server,
    async close() {
      await client.close();
      await server.close();
    },
  };
}

export function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response,
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return handler(url, init);
  }) as unknown as typeof fetch;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function parseToolText(result: { content: Array<{ type: string; text?: string }> }): unknown {
  const text = result.content.find((c) => c.type === 'text')?.text;
  if (text == null) throw new Error('no text content');
  return JSON.parse(text);
}
