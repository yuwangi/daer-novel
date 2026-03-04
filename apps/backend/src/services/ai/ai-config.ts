import { db, schema } from '../../database';
import { eq } from 'drizzle-orm';
import { AIProviderFactory, AIProviderConfig } from './providers';


/**
 * Loads the AI config for the given userId from the database.
 * Falls back to OPENAI_API_KEY environment variable if no DB config is found.
 * Throws an error if neither is configured.
 */
export async function getAIProviderConfig(userId: string): Promise<AIProviderConfig> {
  const aiConfig = await db.query.aiConfigs.findFirst({
    where: eq(schema.aiConfigs.userId, userId),
  });

  if (!aiConfig) {
    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      throw new Error('No AI configuration found. Please configure AI settings or set OPENAI_API_KEY in environment.');
    }
    return {
      provider: 'openai' as const,
      model: 'gpt-5.2',
      apiKey,
      baseUrl: process.env.OPENAI_BASE_URL || undefined,
    };
  }

  return {
    provider: aiConfig.provider as 'openai' | 'anthropic' | 'deepseek',
    model: aiConfig.model,
    apiKey: aiConfig.apiKey,
    baseUrl: aiConfig.baseUrl || undefined,
    temperature: aiConfig.parameters?.temperature || 0.7,
    maxTokens: aiConfig.parameters?.maxTokens,
    topP: aiConfig.parameters?.topP,
  };
}

/**
 * Creates an AI provider instance from the user's AI config.
 * Convenience wrapper around getAIProviderConfig + AIProviderFactory.create.
 */
export async function createAIProvider(userId: string) {
  const config = await getAIProviderConfig(userId);
  return AIProviderFactory.create(config);
}
