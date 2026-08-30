import type {
  CompletionRequest,
  CompletionResult,
  LLMProvider,
  ModelInfo,
  Provider,
  StructuredRequest,
  StructuredResult,
} from '@devdigest/shared';
import { OpenRouterProvider, parseWithRepair, toJsonSchema } from '@devdigest/reviewer-core';

const NOT_USED = 'CI runner LLM adapter only implements completeStructured';

/**
 * Actions-side LLM port. OpenAI/OpenRouter reuse reviewer-core's OpenRouterProvider
 * (the engine's structured-output path). Anthropic is a thin completeStructured
 * adapter using the same parseWithRepair loop — not a second review cycle.
 */
export function createLlmProvider(provider: Provider): LLMProvider {
  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY missing');
    return new OpenRouterProvider(key, { id: 'openai', baseURL: 'https://api.openai.com/v1' });
  }
  if (provider === 'openrouter') {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY missing');
    return new OpenRouterProvider(key);
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  return new AnthropicStructuredProvider(key);
}

class AnthropicStructuredProvider implements LLMProvider {
  readonly id = 'anthropic' as const;

  constructor(private readonly apiKey: string) {}

  async listModels(): Promise<ModelInfo[]> {
    throw new Error(NOT_USED);
  }
  async complete(_req: CompletionRequest): Promise<CompletionResult> {
    throw new Error(NOT_USED);
  }
  async embed(_texts: string[]): Promise<number[][]> {
    throw new Error(NOT_USED);
  }

  async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const jsonSchema = toJsonSchema(req.schema, req.schemaName);
    const toolName = req.schemaName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const maxRetries = req.maxRetries ?? 2;
    const system = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const messages: unknown[] = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
    let tokensIn = 0;
    let tokensOut = 0;
    let lastRaw = '';

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: req.model,
          max_tokens: req.maxTokens ?? 4096,
          temperature: req.temperature ?? 0,
          system: system || undefined,
          messages,
          tools: [
            {
              name: toolName,
              description: `Return the result as ${req.schemaName}.`,
              input_schema: jsonSchema.schema,
            },
          ],
          tool_choice: { type: 'tool', name: toolName },
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      const data = (await res.json()) as {
        content?: Array<{ type: string; input?: unknown }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      tokensIn += data.usage?.input_tokens ?? 0;
      tokensOut += data.usage?.output_tokens ?? 0;
      const toolUse = data.content?.find((b) => b.type === 'tool_use');
      lastRaw = toolUse ? JSON.stringify(toolUse.input ?? {}) : '';

      const parsed = parseWithRepair(req.schema, lastRaw);
      if (parsed.ok) {
        return {
          data: parsed.data,
          model: req.model,
          tokensIn,
          tokensOut,
          costUsd: null,
          raw: lastRaw,
          attempts: attempt,
        };
      }
      messages.push({ role: 'assistant', content: data.content ?? [] });
      messages.push({ role: 'user', content: parsed.repromptMessage });
    }
    throw new Error(`Anthropic structured output failed schema validation for ${req.schemaName}`);
  }
}
