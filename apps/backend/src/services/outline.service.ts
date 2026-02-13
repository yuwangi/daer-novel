import { db, schema } from '../database';
import { eq, desc } from 'drizzle-orm';
import { BaseService } from './base.service';

export class OutlineService extends BaseService {
  constructor() {
    super('OutlineService');
  }

  /**
   * Get all versions for a novel
   */
  async getVersions(novelId: string) {
    try {
      console.log('Fetching versions for novel:', novelId);
      
      if (!db.query.outlineVersions) {
        console.error('db.query.outlineVersions is undefined. Available keys:', Object.keys(db.query));
        throw new Error('Database schema for outlineVersions not loaded');
      }

      const result = await db.query.outlineVersions.findMany({
        where: eq(schema.outlineVersions.novelId, novelId),
        orderBy: [desc(schema.outlineVersions.version)],
      });
      console.log('Found versions:', result.length);
      return result;
    } catch (error) {
      console.error('Error in getVersions:', error);
      throw error;
    }
  }

  /**
   * Get specific version
   */
  async getVersion(id: string) {
    return await db.query.outlineVersions.findFirst({
      where: eq(schema.outlineVersions.id, id),
    });
  }

  /**
   * Get latest version number
   */
  async getLatestVersionNumber(novelId: string): Promise<number> {
    const latest = await db.query.outlineVersions.findFirst({
      where: eq(schema.outlineVersions.novelId, novelId),
      orderBy: [desc(schema.outlineVersions.version)],
    });
    return latest?.version || 0;
  }

  /**
   * Create new version
   */
  async createVersion(
    novelId: string, 
    content: string, 
    context: any, 
    mode: string = 'initial'
  ) {
    const latestVersion = await this.getLatestVersionNumber(novelId);
    const newVersion = latestVersion + 1;

    const [outline] = await db
      .insert(schema.outlineVersions)
      .values({
        novelId,
        content,
        version: newVersion,
        generationMode: mode,
        generationContext: context,
      })
      .returning();

    // Update novel current version
    await db
      .update(schema.novels)
      .set({ currentOutlineVersion: newVersion })
      .where(eq(schema.novels.id, novelId));

    return outline;
  }

  /**
   * Lock a version
   */
  async toggleLock(id: string, isLocked: boolean) {
    return await db
      .update(schema.outlineVersions)
      .set({ isLocked: isLocked ? 1 : 0 })
      .where(eq(schema.outlineVersions.id, id))
      .returning();
  }

  async rollback(novelId: string, targetVersionId: string) {
    const targetVersion = await this.getVersion(targetVersionId);
    if (!targetVersion) throw new Error('Target version not found');

    return await this.createVersion(
      novelId,
      targetVersion.content,
      { 
        ...targetVersion.generationContext as object, 
        rollbackFrom: targetVersion.version 
      },
      'rollback'
    );
  }

  /**
   * Stream outline generation
   */
  async generateStream(
    novelId: string, 
    userId: string,
    mode: string,
    existingOutline: string | undefined,
    onChunk: (chunk: string) => void
  ) {
    // 1. Get novel data with characters and knowledge bases
    const novel = await db.query.novels.findFirst({
      where: eq(schema.novels.id, novelId),
      with: {
        characters: true,
        knowledgeBases: {
          with: {
            documents: true
          }
        }
      }
    });
    
    if (!novel) throw new Error('Novel not found');

    // 2. Get AI Config for user (use default or first available)
    const aiConfig = await db.query.aiConfigs.findFirst({
      where: eq(schema.aiConfigs.userId, userId),
    });

    // Fallback config if none found
    const config = aiConfig ? {
        provider: aiConfig.provider as 'openai' | 'anthropic' | 'deepseek',
        model: aiConfig.model,
        apiKey: aiConfig.apiKey,
        baseUrl: aiConfig.baseUrl || undefined,
        temperature: aiConfig.parameters?.temperature || 0.7,
        maxTokens: aiConfig.parameters?.maxTokens || 4000,
      } : {
        provider: 'openai' as const,
        model: 'gpt-3.5-turbo',
        apiKey: process.env.OPENAI_API_KEY || '',
        baseUrl: process.env.OPENAI_BASE_URL || undefined,
      };

    if (!config.apiKey) {
      throw new Error('AI configuration missing');
    }

    // 3. Initialize Provider and Agent
    const { AIProviderFactory } = await import('./ai/providers');
    const { OutlineAgent } = await import('./ai/agents');
    
    const provider = AIProviderFactory.create(config);
    const agent = new OutlineAgent(provider);

    // 4. Execute Stream
    await agent.executeStream(
      { 
        novel,
        characters: (novel as any).characters,
        knowledgeBase: (novel as any).knowledgeBases?.flatMap((kb: any) => 
          kb.documents?.map((doc: any) => `${doc.title}:\n${doc.content}`) || []
        )
      },
      { mode, existingOutline },
      onChunk
    );
  }
}

export const outlineService = new OutlineService();
