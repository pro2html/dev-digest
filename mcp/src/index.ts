#!/usr/bin/env node
/**
 * Stdio entry for @devdigest/mcp (Cursor / other MCP hosts).
 * Do not log to stdout — it is the MCP transport.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createDevDigestMcp } from './server.js';

async function main(): Promise<void> {
  const { server } = createDevDigestMcp();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('devdigest-mcp failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});
