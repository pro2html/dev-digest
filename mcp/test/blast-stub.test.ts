import { describe, it, expect } from 'vitest';
import { parseToolText, withMcpClient, mockFetch, jsonResponse } from './helpers.js';

const repoId = '55555555-5555-4555-8555-555555555555';

describe('get_blast_radius', () => {
  it('resolves repo+pr and returns projected blast map', async () => {
    const fetchImpl = mockFetch((url) => {
      if (url.endsWith('/repos')) {
        return jsonResponse([{ id: repoId, full_name: 'acme/payments-api' }]);
      }
      if (url.includes(`/repos/${repoId}/pulls`)) {
        return jsonResponse([{ id: 'pr-uuid', number: 482, title: 'Rate limit' }]);
      }
      if (url.includes('/pulls/pr-uuid/blast')) {
        return jsonResponse({
          status: 'ok',
          summary: '1 symbol · 2 callers · 1 endpoint · 0 crons',
          totals: { symbols: 1, callers: 2, endpoints: 1, crons: 0 },
          changed_symbols: [{ name: 'rateLimit', file: 'src/rate.ts', kind: 'function' }],
          downstream: [
            {
              symbol: 'rateLimit',
              callers: [
                { name: 'handler', file: 'src/api.ts', line: 10 },
                { name: 'hook', file: 'src/hooks.ts', line: 4 },
              ],
              endpoints_affected: ['GET /api/items'],
              crons_affected: [],
            },
          ],
        });
      }
      return jsonResponse({ error: { message: `unexpected ${url}` } }, 500);
    });

    const { client, close } = await withMcpClient({
      api: { baseUrl: 'http://localhost:3001', fetchImpl },
    });

    try {
      const res = await client.callTool({
        name: 'get_blast_radius',
        arguments: { repo: repoId, pr: 482 },
      });
      expect(res.isError).toBeFalsy();
      const body = parseToolText(res as { content: Array<{ type: string; text?: string }> }) as {
        status: string;
        repo: string;
        pr: number;
        changed_symbols: unknown[];
        downstream: Array<{ callers: unknown[] }>;
        totals?: { symbols: number };
      };
      expect(body.status).toBe('ok');
      expect(body.repo).toBe('acme/payments-api');
      expect(body.pr).toBe(482);
      expect(body.changed_symbols).toHaveLength(1);
      expect(body.downstream[0]?.callers).toHaveLength(2);
      expect(body.totals?.symbols).toBe(1);
    } finally {
      await close();
    }
  });

  it('passes through degraded status with hint', async () => {
    const fetchImpl = mockFetch((url) => {
      if (url.endsWith('/repos')) {
        return jsonResponse([{ id: repoId, full_name: 'acme/payments-api' }]);
      }
      if (url.includes(`/repos/${repoId}/pulls`)) {
        return jsonResponse([{ id: 'pr-uuid', number: 482 }]);
      }
      if (url.includes('/pulls/pr-uuid/blast')) {
        return jsonResponse({
          status: 'degraded',
          reason: 'no_data',
          summary: '0 symbols · 0 callers · 0 endpoints · 0 crons',
          totals: { symbols: 0, callers: 0, endpoints: 0, crons: 0 },
          changed_symbols: [],
          downstream: [],
        });
      }
      return jsonResponse({}, 500);
    });

    const { client, close } = await withMcpClient({
      api: { baseUrl: 'http://localhost:3001', fetchImpl },
    });

    try {
      const res = await client.callTool({
        name: 'get_blast_radius',
        arguments: { repo: repoId, pr: 482 },
      });
      expect(res.isError).toBeFalsy();
      const body = parseToolText(res as { content: Array<{ type: string; text?: string }> }) as {
        status: string;
        reason?: string;
        hint?: string;
      };
      expect(body.status).toBe('degraded');
      expect(body.reason).toBe('no_data');
      expect(body.hint).toBeTruthy();
    } finally {
      await close();
    }
  });
});
