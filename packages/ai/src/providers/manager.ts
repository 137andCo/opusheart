import type { AIProvider } from './types.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';

export interface AIProviderConfig {
  provider: string;
  baseUrl?: string;
  apiKey: string;
  model: string;
}

export class AIProviderManager {
  private provider: AIProvider | null = null;

  configure(config: AIProviderConfig): void {
    switch (config.provider) {
      case 'openai':
        this.provider = new OpenAIProvider(
          config.baseUrl || 'https://api.openai.com',
          config.apiKey,
          config.model,
        );
        break;
      case 'anthropic':
        this.provider = new AnthropicProvider(config.apiKey, config.model);
        break;
      default:
        throw new Error(`Unknown AI provider: ${config.provider}`);
    }
  }

  isEnabled(): boolean {
    return this.provider !== null;
  }

  getProvider(): AIProvider {
    if (!this.provider) throw new Error('AI not configured');
    return this.provider;
  }
}

export const aiManager = new AIProviderManager();
