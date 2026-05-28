import type { AIProvider, GenerateOptions, AIResponse } from './types.js';

export class AnthropicProvider implements AIProvider {
  name = 'anthropic';

  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async generateText(prompt: string, options?: GenerateOptions): Promise<AIResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens || 1000,
        system: options?.systemPrompt,
        messages: [{ role: 'user' as const, content: prompt }],
      }),
    });

    const data = await response.json() as Record<string, unknown>;
    const content = data['content'] as Array<{ text: string }> | undefined;
    const usage = data['usage'] as { input_tokens: number; output_tokens: number } | undefined;

    return {
      text: content?.[0]?.text || '',
      usage: usage
        ? { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
        : undefined,
    };
  }
}
