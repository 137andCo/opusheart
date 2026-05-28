export interface AIProvider {
  name: string;
  generateText(prompt: string, options?: GenerateOptions): Promise<AIResponse>;
}

export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AIResponse {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}
