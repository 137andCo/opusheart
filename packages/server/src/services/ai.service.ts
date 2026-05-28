import { aiManager } from '@opusheart/ai';
import { AuditLog } from '../models/AuditLog.js';

export class AIService {
  private async generate(
    feature: string,
    prompt: string,
    systemPrompt?: string,
    userId?: string,
  ): Promise<string | null> {
    if (!aiManager.isEnabled()) return null;

    try {
      const provider = aiManager.getProvider();
      const result = await provider.generateText(prompt, { systemPrompt, maxTokens: 2000 });

      // Audit log AI usage
      await AuditLog.create({
        action: 'ai_request',
        actorHash: userId || 'system',
        actorRole: 'user',
        target: feature,
        metadata: {
          provider: provider.name,
          promptPreview: prompt.substring(0, 200),
          tokensUsed: result.usage,
        },
      });

      return result.text;
    } catch (err) {
      console.error(`[AIService] ${feature} failed:`, err);
      return null;
    }
  }

  async summarizeResource(
    name: string,
    description: string,
    userId?: string,
  ): Promise<string | null> {
    return this.generate(
      'summarize_resource',
      `Summarize the eligibility requirements for this community resource:\n\nName: ${name}\nDescription: ${description}`,
      'You are a helpful community resource assistant. Provide clear, concise eligibility summaries.',
      userId,
    );
  }

  async draftContent(
    type: string,
    context: string,
    userId?: string,
  ): Promise<string | null> {
    return this.generate(
      'draft_content',
      `Draft a ${type} based on this context:\n\n${context}`,
      `You are a helpful content writer for a community organization. Write warm, professional ${type} content.`,
      userId,
    );
  }

  async categorizePrayer(
    content: string,
    userId?: string,
  ): Promise<string | null> {
    return this.generate(
      'categorize_prayer',
      `Categorize this prayer request into one of: health, family, provision, gratitude, grief, community, guidance, other.\n\nPrayer: ${content}\n\nRespond with ONLY the category name.`,
      'You categorize prayer requests. Respond with only the category name, nothing else.',
      userId,
    );
  }

  async translateContent(
    text: string,
    targetLanguage: string,
    userId?: string,
  ): Promise<string | null> {
    return this.generate(
      'translate',
      `Translate the following text to ${targetLanguage}:\n\n${text}`,
      'You are a translator. Translate accurately while maintaining tone and meaning.',
      userId,
    );
  }

  async generateSermonSummary(
    title: string,
    description: string,
    notes?: string,
    userId?: string,
  ): Promise<{ summary: string; keyTakeaways: string[] } | null> {
    const result = await this.generate(
      'sermon_summary',
      `Generate a summary and 3-5 key takeaways for this sermon:\n\nTitle: ${title}\nDescription: ${description}${notes ? `\nNotes: ${notes}` : ''}`,
      'You summarize sermons. Return JSON: { "summary": "...", "keyTakeaways": ["...", "..."] }',
      userId,
    );

    if (!result) return null;

    try {
      return JSON.parse(result) as { summary: string; keyTakeaways: string[] };
    } catch {
      return { summary: result, keyTakeaways: [] };
    }
  }
}

export const aiService = new AIService();
