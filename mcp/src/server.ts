import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient, type ApiClientOptions } from './api/client.js';
import { registerAll } from './tools/index.js';

export interface CreateDevDigestMcpOptions {
  api?: ApiClientOptions;
}

/** Build a configured McpServer (testable without stdio). */
export function createDevDigestMcp(opts: CreateDevDigestMcpOptions = {}): {
  server: McpServer;
  api: ApiClient;
} {
  const api = new ApiClient(opts.api);
  const server = new McpServer({
    name: 'devdigest-mcp',
    version: '0.0.0',
  });
  registerAll(server, api);
  return { server, api };
}
