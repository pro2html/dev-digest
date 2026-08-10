import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api/client.js';
import { resolveRepo } from '../api/resolve.js';
import { GetConventionsArgs } from '../schemas/args.js';
import type { ConventionsResult } from '../schemas/results.js';
import { jsonResult, toolErrorResult } from '../errors.js';

interface ConventionCandidate {
  id: string;
  category: string;
  rule: string;
  status: string;
  confidence?: number;
  applies_to?: string | null;
}

interface ConventionsApiResponse {
  candidates: ConventionCandidate[];
  index_state?: unknown;
}

export function registerGetConventions(server: McpServer, api: ApiClient): void {
  server.registerTool(
    'get_conventions',
    {
      description:
        'List repo convention candidates (L02 extractor data) for grounding. Pass repo id (UUID); optional status filter (default accepted). Does not extract new conventions — open the studio Conventions page for that. Omits evidence snippets to save tokens.',
      inputSchema: GetConventionsArgs.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const parsed = GetConventionsArgs.parse(args);
        const status = parsed.status ?? 'accepted';
        const limit = parsed.limit ?? 30;
        const repo = await resolveRepo(api, parsed.repo);
        const qs = status === 'all' ? '' : `?status=${encodeURIComponent(status)}`;
        const data = await api.get<ConventionsApiResponse>(
          `/repos/${repo.id}/conventions${qs}`,
        );
        const all = data.candidates ?? [];
        const sliced = all.slice(0, limit);
        const result: ConventionsResult = {
          repo: repo.full_name,
          index_state: data.index_state ?? null,
          conventions: sliced.map((c) => ({
            id: c.id,
            category: c.category,
            rule: c.rule,
            status: c.status,
            confidence: c.confidence,
            applies_to: c.applies_to ?? null,
          })),
        };
        if (all.length > limit) result.truncated = true;
        if (sliced.length === 0) {
          result.hint =
            'No conventions yet. Extract them in the studio Conventions page (L02).';
        }
        return jsonResult(result);
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );
}
