import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../src/api/client.js';
import { resolveRepo, resolvePull } from '../src/api/resolve.js';
import { waitForRun } from '../src/api/wait-run.js';
import { McpToolError } from '../src/errors.js';
import { jsonResponse, mockFetch, parseToolText, withMcpClient } from './helpers.js';

describe('ApiClient', () => {
  it('maps network failure to actionable api_unreachable', async () => {
    const fetchImpl = mockFetch(() => {
      throw new TypeError('fetch failed');
    });
    const api = new ApiClient({ baseUrl: 'http://localhost:3001', fetchImpl });
    await expect(api.get('/agents')).rejects.toMatchObject({
      code: 'api_unreachable',
    });
  });

  it('rejects non-http base URL', () => {
    expect(() => new ApiClient({ baseUrl: 'file:///tmp' })).toThrow(/http/);
  });
});

describe('resolve helpers', () => {
  it('resolveRepo finds by id and errors forward', async () => {
    const repoId = '55555555-5555-4555-8555-555555555555';
    const fetchImpl = mockFetch(() =>
      jsonResponse([{ id: repoId, full_name: 'acme/payments-api' }]),
    );
    const api = new ApiClient({ baseUrl: 'http://localhost:3001', fetchImpl });
    await expect(resolveRepo(api, repoId)).resolves.toEqual({
      id: repoId,
      full_name: 'acme/payments-api',
    });
    await expect(resolveRepo(api, '99999999-9999-4999-8999-999999999999')).rejects.toThrow(
      /Import it in the studio/,
    );
  });

  it('resolvePull finds by number', async () => {
    const fetchImpl = mockFetch(() => jsonResponse([{ id: 'p1', number: 482, title: 'x' }]));
    const api = new ApiClient({ baseUrl: 'http://localhost:3001', fetchImpl });
    await expect(resolvePull(api, 'r1', 482)).resolves.toMatchObject({ id: 'p1', number: 482 });
    await expect(resolvePull(api, 'r1', 999)).rejects.toThrow(/not imported/);
  });
});

describe('waitForRun', () => {
  it('returns when status is terminal', async () => {
    let calls = 0;
    const fetchImpl = mockFetch(() => {
      calls += 1;
      const status = calls < 2 ? 'running' : 'done';
      return jsonResponse([{ run_id: 'run-1', agent_id: 'a1', agent_name: 'A', status }]);
    });
    const api = new ApiClient({ baseUrl: 'http://localhost:3001', fetchImpl });
    const sleep = vi.fn(async () => undefined);
    const row = await waitForRun(api, 'pr-1', 'run-1', {
      timeoutMs: 10_000,
      pollMs: 1,
      sleep,
    });
    expect(row.status).toBe('done');
    expect(sleep).toHaveBeenCalled();
  });

  it('throws run_timeout with run_id guidance', async () => {
    const fetchImpl = mockFetch(() =>
      jsonResponse([{ run_id: 'run-1', agent_id: null, agent_name: null, status: 'running' }]),
    );
    const api = new ApiClient({ baseUrl: 'http://localhost:3001', fetchImpl });
    await expect(
      waitForRun(api, 'pr-1', 'run-1', {
        timeoutMs: 5,
        pollMs: 1,
        sleep: async () => undefined,
      }),
    ).rejects.toThrow(/get_findings with run_id=run-1/);
  });
});

describe('MCP tools (mocked HTTP)', () => {
  beforeEach(() => {
    process.env['DEVDIGEST_MCP_POLL_MS'] = '1';
  });

  afterEach(() => {
    delete process.env['DEVDIGEST_MCP_POLL_MS'];
  });

  function setup(handler: (url: string, method: string, body?: unknown) => Response) {
    const fetchImpl = mockFetch((url, init) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      let body: unknown;
      if (init?.body) body = JSON.parse(String(init.body));
      return handler(url, method, body);
    });
    return withMcpClient({ api: { baseUrl: 'http://localhost:3001', fetchImpl } });
  }

  it('tools/list order is locked', async () => {
    const { client, close } = await setup(() => jsonResponse([]));
    try {
      const listed = await client.listTools();
      expect(listed.tools.map((t) => t.name)).toEqual([
        'list_agents',
        'run_agent_on_pr',
        'get_findings',
        'get_conventions',
        'get_blast_radius',
      ]);
    } finally {
      await close();
    }
  });

  it('list_agents returns all agents without prompts', async () => {
    const { client, close } = await setup((url) => {
      if (url.endsWith('/agents')) {
        return jsonResponse([
          {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'General',
            description: 'd',
            provider: 'openai',
            model: 'gpt-4.1',
            enabled: true,
            system_prompt: 'SECRET',
            output_schema: { type: 'object' },
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Off',
            provider: 'openai',
            model: 'gpt-4.1',
            enabled: false,
            system_prompt: 'SECRET2',
          },
        ]);
      }
      return jsonResponse({}, 404);
    });

    try {
      const res = await client.callTool({ name: 'list_agents', arguments: {} });
      const body = parseToolText(res as { content: Array<{ type: string; text?: string }> }) as {
        agents: unknown[];
      };
      expect(body.agents).toHaveLength(2);
      expect(body.agents[0]).toEqual({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'General',
        description: 'd',
        provider: 'openai',
        model: 'gpt-4.1',
        enabled: true,
      });
      expect(JSON.stringify(body)).not.toContain('SECRET');
      expect(JSON.stringify(body)).not.toContain('system_prompt');
    } finally {
      await close();
    }
  });

  it('get_findings projects summary by run_id only', async () => {
    const runId = '33333333-3333-4333-8333-333333333333';
    const { client, close } = await setup((url) => {
      if (url.includes(`/runs/${runId}/summary`)) {
        return jsonResponse({
          run_id: runId,
          agent_id: '11111111-1111-4111-8111-111111111111',
          agent_name: 'General',
          status: 'done',
          verdict: 'approve',
          score: 90,
          summary: 'ok',
          findings: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              severity: 'WARNING',
              category: 'bug',
              title: 't',
              file: 'a.ts',
              start_line: 1,
              end_line: 2,
              rationale: 'r',
            },
          ],
        });
      }
      return jsonResponse({}, 404);
    });

    try {
      const res = await client.callTool({ name: 'get_findings', arguments: { run_id: runId } });
      const body = parseToolText(res as { content: Array<{ type: string; text?: string }> }) as {
        run_id: string;
        findings: unknown[];
        status: string;
      };
      expect(body.run_id).toBe(runId);
      expect(body.findings).toHaveLength(1);
      expect(body.status).toBe('done');
    } finally {
      await close();
    }
  });

  it('get_findings errors when still running', async () => {
    const runId = '33333333-3333-4333-8333-333333333333';
    const { client, close } = await setup(() =>
      jsonResponse({
        run_id: runId,
        agent_id: null,
        agent_name: null,
        status: 'running',
        verdict: null,
        score: null,
        summary: null,
        findings: [],
      }),
    );

    try {
      const res = await client.callTool({ name: 'get_findings', arguments: { run_id: runId } });
      expect(res.isError).toBe(true);
      const text = (res.content as Array<{ text?: string }>)[0]?.text ?? '';
      expect(text).toMatch(/still in progress/);
    } finally {
      await close();
    }
  });

  it('get_conventions resolves repo and caps list', async () => {
    const { client, close } = await setup((url) => {
      if (url.endsWith('/repos')) {
        return jsonResponse([
          { id: '55555555-5555-4555-8555-555555555555', full_name: 'acme/payments-api' },
        ]);
      }
      if (url.includes('/conventions')) {
        return jsonResponse({
          candidates: Array.from({ length: 5 }, (_, i) => ({
            id: `66666666-6666-4666-8666-66666666666${i}`,
            category: 'naming',
            rule: `rule ${i}`,
            status: 'accepted',
            confidence: 0.9,
            applies_to: null,
            evidence_snippet: 'LONG EVIDENCE SHOULD NOT APPEAR',
          })),
          index_state: { status: 'ready' },
        });
      }
      return jsonResponse({}, 404);
    });

    try {
      const res = await client.callTool({
        name: 'get_conventions',
        arguments: { repo: '55555555-5555-4555-8555-555555555555', limit: 2 },
      });
      const body = parseToolText(res as { content: Array<{ type: string; text?: string }> }) as {
        conventions: unknown[];
        truncated?: boolean;
      };
      expect(body.conventions).toHaveLength(2);
      expect(body.truncated).toBe(true);
      expect(JSON.stringify(body)).not.toContain('LONG EVIDENCE');
    } finally {
      await close();
    }
  });

  it('run_agent_on_pr orchestrates create → wait → summary', async () => {
    const agentId = '11111111-1111-4111-8111-111111111111';
    const repoId = '55555555-5555-4555-8555-555555555555';
    const prId = '77777777-7777-4777-8777-777777777777';
    const runId = '33333333-3333-4333-8333-333333333333';
    let runPolls = 0;

    const { client, close } = await setup((url, method, body) => {
      if (url.endsWith('/agents') && method === 'GET') {
        return jsonResponse([{ id: agentId, name: 'General', enabled: true }]);
      }
      if (url.endsWith('/repos')) {
        return jsonResponse([{ id: repoId, full_name: 'acme/payments-api' }]);
      }
      if (url.includes(`/repos/${repoId}/pulls`)) {
        return jsonResponse([{ id: prId, number: 482 }]);
      }
      if (url.includes(`/pulls/${prId}/review`) && method === 'POST') {
        expect(body).toEqual({ agentId });
        return jsonResponse({ pr_id: prId, runs: [{ run_id: runId }], reviews: [] });
      }
      if (url.includes(`/pulls/${prId}/runs`)) {
        runPolls += 1;
        return jsonResponse([
          {
            run_id: runId,
            agent_id: agentId,
            agent_name: 'General',
            status: runPolls < 2 ? 'running' : 'done',
          },
        ]);
      }
      if (url.includes(`/runs/${runId}/summary`)) {
        return jsonResponse({
          run_id: runId,
          agent_id: agentId,
          agent_name: 'General',
          status: 'done',
          verdict: 'request_changes',
          score: 65,
          summary: 'Hardcoded secret',
          findings: [],
        });
      }
      return jsonResponse({ error: { message: `unexpected ${method} ${url}` } }, 500);
    });

    try {
      const res = await client.callTool({
        name: 'run_agent_on_pr',
        arguments: {
          repo: repoId,
          pr: 482,
          agent: agentId,
          timeout_ms: 5000,
        },
      });
      expect(res.isError).toBeFalsy();
      const body = parseToolText(res as { content: Array<{ type: string; text?: string }> }) as {
        run_id: string;
        verdict: string;
        status: string;
      };
      expect(body.run_id).toBe(runId);
      expect(body.verdict).toBe('request_changes');
      expect(body.status).toBe('done');
    } finally {
      await close();
    }
  });
});

describe('McpToolError', () => {
  it('carries code', () => {
    const err = new McpToolError('x', 'y');
    expect(err.code).toBe('x');
    expect(err.message).toBe('y');
  });
});
