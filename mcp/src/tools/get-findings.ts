import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api/client.js';
import { GetFindingsArgs } from '../schemas/args.js';
import {
  DEFAULT_MAX_FINDINGS,
  projectRunResult,
  type RawRunSummaryLike,
} from '../schemas/results.js';
import { McpToolError, jsonResult, toolErrorResult } from '../errors.js';

export function registerGetFindings(server: McpServer, api: ApiClient): void {
  server.registerTool(
    'get_findings',
    {
      description:
        'Get concise verdict + findings for an already completed review run by run_id. Use after run_agent_on_pr returns a run_id, or when a previous wait timed out. Does not start a new review (use run_agent_on_pr for that).',
      inputSchema: GetFindingsArgs.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const parsed = GetFindingsArgs.parse(args);
        const maxFindings = parsed.max_findings ?? DEFAULT_MAX_FINDINGS;
        const raw = await api.get<RawRunSummaryLike>(`/runs/${parsed.run_id}/summary`);
        if (raw.status === 'running') {
          throw new McpToolError(
            'run_in_progress',
            'Run is still in progress. Wait and retry get_findings, or call run_agent_on_pr to start a new review.',
          );
        }
        return jsonResult(projectRunResult(raw, maxFindings));
      } catch (err) {
        if (err instanceof McpToolError && err.code === 'not_found') {
          return toolErrorResult(
            new McpToolError(
              'not_found',
              `No run with id=${String((args as { run_id?: string }).run_id ?? '?')}. Call list_agents then run_agent_on_pr, or check the run id from a previous run_agent_on_pr result.`,
            ),
          );
        }
        return toolErrorResult(err);
      }
    },
  );
}
