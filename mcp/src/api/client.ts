import { McpToolError, apiUnreachable } from '../errors.js';

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Thin HTTP client for @devdigest/api.
 * Base URL comes only from env / constructor — never from tool args (no SSRF).
 */
export class ApiClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ApiClientOptions = {}) {
    const raw =
      opts.baseUrl ??
      process.env['DEVDIGEST_API_BASE'] ??
      'http://localhost:3001';
    this.baseUrl = normalizeBaseUrl(raw);
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw apiUnreachable(this.baseUrl);
    }

    if (!res.ok) {
      throw await mapHttpError(res, this.baseUrl);
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new McpToolError(
        'invalid_json',
        `DevDigest API returned non-JSON at ${path}. Check the API is healthy, then retry.`,
      );
    }
  }
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new McpToolError(
      'invalid_base_url',
      `Invalid DEVDIGEST_API_BASE "${raw}". Set it to an absolute URL like http://localhost:3001.`,
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new McpToolError(
      'invalid_base_url',
      `DEVDIGEST_API_BASE must be http(s). Got protocol ${parsed.protocol}`,
    );
  }
  return trimmed;
}

async function mapHttpError(res: Response, base: string): Promise<McpToolError> {
  if (res.status === 404) {
    const detail = await safeErrorMessage(res);
    return new McpToolError(
      'not_found',
      detail ??
        `Resource not found (HTTP 404) at DevDigest API ${base}. Check the id and retry.`,
    );
  }
  if (res.status === 422 || res.status === 400) {
    const detail = await safeErrorMessage(res);
    return new McpToolError(
      'validation_error',
      detail ?? `Invalid request to DevDigest API (HTTP ${res.status}). Fix the arguments and retry.`,
    );
  }
  if (res.status >= 500) {
    return new McpToolError(
      'api_error',
      `DevDigest API error (HTTP ${res.status}). Check server logs, ensure Postgres is up, then retry.`,
    );
  }
  const detail = await safeErrorMessage(res);
  return new McpToolError(
    'http_error',
    detail ?? `DevDigest API returned HTTP ${res.status}. Retry or check the API.`,
  );
}

/** Treat API error bodies as untrusted text — strip control chars, cap length. */
async function safeErrorMessage(res: Response): Promise<string | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    let msg: string | undefined;
    try {
      const body = JSON.parse(text) as { error?: { message?: string }; message?: string };
      msg = body.error?.message ?? body.message;
    } catch {
      msg = text;
    }
    if (!msg) return null;
    const cleaned = msg.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300);
    return cleaned || null;
  } catch {
    return null;
  }
}
