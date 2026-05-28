import type { AIProvider, GenerateOptions, AIResponse } from './types.js';

export class OpenAIProvider implements AIProvider {
  name = 'openai';

  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string,
  ) {}

  async generateText(prompt: string, options?: GenerateOptions): Promise<AIResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        max_tokens: options?.maxTokens || 1000,
        temperature: options?.temperature ?? 0.7,
      }),
    });

    const data = await response.json() as Record<string, unknown>;
    const choices = data['choices'] as Array<{ message: { content: string } }> | undefined;
    const usage = data['usage'] as { prompt_tokens: number; completion_tokens: number } | undefined;

    return {
      text: choices?.[0]?.message?.content || '',
      usage: usage
        ? { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens }
        : undefined,
    };
  }
}
