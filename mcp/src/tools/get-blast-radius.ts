import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api/client.js';
import { resolvePull, resolveRepo } from '../api/resolve.js';
import { GetBlastRadiusArgs } from '../schemas/args.js';
import {
  MAX_BLAST_CALLERS_PER_SYMBOL,
  MAX_BLAST_DOWNSTREAM,
  projectBlastResult,
  type RawPrBlastLike,
} from '../schemas/results.js';
import { jsonResult, toolErrorResult } from '../errors.js';

/**
 * PR blast-radius map via `GET /pulls/:id/blast` (repo-intel facts only).
 */
export function registerGetBlastRadius(server: McpServer, api: ApiClient): void {
  server.registerTool(
    'get_blast_radius',
    {
      description:
        'Map potential PR impact from the repo index: changed symbols, callers, and reachable HTTP endpoints/crons. Pass repo id (UUID) + PR number. Returns status ok|partial|degraded — never invents edges. Requires API + indexed repo; use get_findings for review verdicts.',
      inputSchema: GetBlastRadiusArgs.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const parsed = GetBlastRadiusArgs.parse(args);
        const repo = await resolveRepo(api, parsed.repo);
        const pull = await resolvePull(api, repo.id, parsed.pr);
        const raw = await api.get<RawPrBlastLike>(`/pulls/${pull.id}/blast`);
        const result = projectBlastResult(raw, {
          repo: repo.full_name,
          pr: parsed.pr,
          maxDownstream: MAX_BLAST_DOWNSTREAM,
          maxCallersPerSymbol: MAX_BLAST_CALLERS_PER_SYMBOL,
        });
        return jsonResult(result);
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );
}
