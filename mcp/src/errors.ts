/**
 * MCP tool errors with forward-looking next steps (Course 4: Error Leads Forward).
 */
export class McpToolError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'McpToolError';
    this.code = code;
  }
}

export function apiUnreachable(base: string): McpToolError {
  return new McpToolError(
    'api_unreachable',
    `Cannot reach DevDigest API at ${base}. Start it (\`cd server && pnpm dev\` or \`./scripts/dev.sh\`), then retry.`,
  );
}

export function toolErrorResult(err: unknown): {
  content: [{ type: 'text'; text: string }];
  isError: true;
} {
  const message =
    err instanceof McpToolError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

export function jsonResult(data: unknown): {
  content: [{ type: 'text'; text: string }];
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}
