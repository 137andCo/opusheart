export const AI_VERSION = '0.1.0';

export type { AIProvider, GenerateOptions, AIResponse } from './providers/types.js';
export { OpenAIProvider } from './providers/openai.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { AIProviderManager, aiManager } from './providers/manager.js';
export type { AIProviderConfig } from './providers/manager.js';
