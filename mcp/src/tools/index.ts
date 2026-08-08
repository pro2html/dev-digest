import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api/client.js';
import { registerListAgents } from './list-agents.js';
import { registerRunAgentOnPr } from './run-agent-on-pr.js';
import { registerGetFindings } from './get-findings.js';
import { registerGetConventions } from './get-conventions.js';
import { registerGetBlastRadius } from './get-blast-radius.js';

/**
 * Register all tools in locked deterministic order for tools/list:
 * list_agents → run_agent_on_pr → get_findings → get_conventions → get_blast_radius
 */
export function registerAll(server: McpServer, api: ApiClient): void {
  registerListAgents(server, api);
  registerRunAgentOnPr(server, api);
  registerGetFindings(server, api);
  registerGetConventions(server, api);
  registerGetBlastRadius(server, api);
}
