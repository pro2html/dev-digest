import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api/client.js';
import { resolvePull, resolveRepo } from '../api/resolve.js';
import { defaultPollMs, defaultTimeoutMs, waitForRun } from '../api/wait-run.js';
import { RunAgentOnPrArgs } from '../schemas/args.js';
import {
  DEFAULT_MAX_FINDINGS,
  projectRunResult,
  type RawFindingLike,
  type RawRunSummaryLike,
} from '../schemas/results.js';
import { McpToolError, jsonResult, toolErrorResult } from '../errors.js';

interface StartReviewResponse {
  pr_id: string;
  runs: Array<{ run_id: string; agent_id?: string | null }>;
}

interface ReviewDto {
  id: string;
  agent_id: string | null;
  run_id: string | null;
  agent_name?: string | null;
  verdict: string | null;
  summary: string | null;
  score: number | null;
  findings: RawFindingLike[];
}

export function registerRunAgentOnPr(server: McpServer, api: ApiClient): void {
  server.registerTool(
    'run_agent_on_pr',
    {
      description:
        'Start one agent review on a PR, wait until finished, return concise verdict + findings. Only write tool. Pass repo id (UUID), pr number, and agent id from list_agents. On timeout, use get_findings with the returned run_id.',
      inputSchema: RunAgentOnPrArgs.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const parsed = RunAgentOnPrArgs.parse(args);
        const timeoutMs = parsed.timeout_ms ?? defaultTimeoutMs();
        const maxFindings = parsed.max_findings ?? DEFAULT_MAX_FINDINGS;
        const pollMs = defaultPollMs();

        // Verify agent exists (forward-looking error)
        const agents = await api.get<Array<{ id: string; name: string; enabled: boolean }>>(
          '/agents',
        );
        const agent = agents.find((a) => a.id === parsed.agent);
        if (!agent) {
          throw new McpToolError(
            'agent_not_found',
            `Agent not found for id=${parsed.agent}. Call list_agents and pass a returned id.`,
          );
        }

        const repo = await resolveRepo(api, parsed.repo);
        const pull = await resolvePull(api, repo.id, parsed.pr);

        const started = await api.post<StartReviewResponse>(`/pulls/${pull.id}/review`, {
          agentId: parsed.agent,
        });
        const runMeta = started.runs[0];
        if (!runMeta?.run_id) {
          throw new McpToolError(
            'start_failed',
            'Review did not return a run_id. Check the API logs and retry run_agent_on_pr.',
          );
        }
        const runId = runMeta.run_id;

        let terminal;
        try {
          terminal = await waitForRun(api, pull.id, runId, { timeoutMs, pollMs });
        } catch (err) {
          if (err instanceof McpToolError && err.code === 'run_timeout') {
            return jsonResult({
              run_id: runId,
              agent_id: parsed.agent,
              agent_name: agent.name,
              status: 'running',
              verdict: null,
              score: null,
              summary: null,
              findings: [],
              error: err.message,
            });
          }
          throw err;
        }

        if (terminal.status === 'failed' || terminal.status === 'cancelled') {
          return jsonResult({
            run_id: runId,
            agent_id: terminal.agent_id ?? parsed.agent,
            agent_name: terminal.agent_name ?? agent.name,
            status: terminal.status,
            verdict: null,
            score: null,
            summary: null,
            findings: [],
            error: terminal.error ?? `Run ended with status=${terminal.status}`,
          });
        }

        // Prefer summary route (same projection as get_findings)
        try {
          const summary = await api.get<RawRunSummaryLike>(`/runs/${runId}/summary`);
          return jsonResult(projectRunResult(summary, maxFindings));
        } catch {
          // Fallback: list reviews for PR and pick matching run_id
          const reviews = await api.get<ReviewDto[]>(`/pulls/${pull.id}/reviews`);
          const review = reviews.find((r) => r.run_id === runId);
          const projected = projectRunResult(
            {
              run_id: runId,
              agent_id: review?.agent_id ?? parsed.agent,
              agent_name: review?.agent_name ?? agent.name,
              status: terminal.status,
              verdict: review?.verdict ?? null,
              score: review?.score ?? null,
              summary: review?.summary ?? null,
              findings: review?.findings ?? [],
            },
            maxFindings,
          );
          return jsonResult(projected);
        }
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );
}
