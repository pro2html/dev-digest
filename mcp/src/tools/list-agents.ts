import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api/client.js';
import { EmptyArgs } from '../schemas/args.js';
import type { ListAgentsResult } from '../schemas/results.js';
import { jsonResult, toolErrorResult } from '../errors.js';

interface AgentDto {
  id: string;
  name: string;
  description?: string | null;
  provider: string;
  model: string;
  enabled: boolean;
}

export function registerListAgents(server: McpServer, api: ApiClient): void {
  server.registerTool(
    'list_agents',
    {
      description:
        'List all DevDigest reviewer agents (enabled and disabled). Call before run_agent_on_pr to get an agent id. Returns id, name, description, provider, model, enabled — omits prompts/schemas. Prefer over guessing agent ids.',
      inputSchema: EmptyArgs.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const agents = await api.get<AgentDto[]>('/agents');
        const result: ListAgentsResult = {
          agents: agents.map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description ?? null,
            provider: a.provider,
            model: a.model,
            enabled: a.enabled,
          })),
        };
        return jsonResult(result);
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );
}
