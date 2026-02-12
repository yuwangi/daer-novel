import { Router } from 'express';
import { db, schema } from '../database';
import { eq, and } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import { AIProviderFactory } from '../services/ai/providers';
import { TitleAgent, ConceptExpandAgent } from '../services/ai/agents';

const router: Router = Router();

const createNovelSchema = z.object({
  title: z.string().optional(),
  genre: z.array(z.string()).optional(),
  style: z.array(z.string()).optional(),
  targetAudience: z.array(z.string()).optional(),
  targetWords: z.number().optional(),
  minChapterWords: z.number().optional(),
  background: z.string().optional(),
  worldSettings: z.object({
    timeBackground: z.string().optional(),
    worldRules: z.array(z.string()).optional(),
    powerSystem: z.string().optional(),
    forbiddenRules: z.array(z.string()).optional(),
  }).optional(),
});

// Get all novels for user
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const novels = await db.query.novels.findMany({
      where: eq(schema.novels.userId, req.userId!),
      orderBy: (novels, { desc }) => [desc(novels.createdAt)],
    });

    res.json(novels);
  } catch (error) {
    next(error);
  }
});

// Get single novel
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const novel = await db.query.novels.findFirst({
      where: and(
        eq(schema.novels.id, req.params.id),
        eq(schema.novels.userId, req.userId!)
      ),
      with: {
        characters: true,
        knowledgeBases: {
          with: {
            documents: true
          }
        },
        volumes: {
          with: {
            chapters: true,
          },
        },
      },
    });

    if (!novel) {
      throw new AppError('Novel not found', 404);
    }

    res.json(novel);
  } catch (error) {
    next(error);
  }
});

// Create novel
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createNovelSchema.parse(req.body);

    const [novel] = await db
      .insert(schema.novels)
      .values({
        ...data,
        userId: req.userId!,
        status: 'draft',
      })
      .returning();

    res.status(201).json(novel);
  } catch (error) {
    next(error);
  }
});

// Update novel
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = createNovelSchema.partial().parse(req.body);

    const [novel] = await db
      .update(schema.novels)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.novels.id, req.params.id),
          eq(schema.novels.userId, req.userId!)
        )
      )
      .returning();

    if (!novel) {
      throw new AppError('Novel not found', 404);
    }

    res.json(novel);
  } catch (error) {
    next(error);
  }
});

// Delete novel
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await db
      .delete(schema.novels)
      .where(
        and(
          eq(schema.novels.id, req.params.id),
          eq(schema.novels.userId, req.userId!)
        )
      );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Get characters for novel
router.get('/:id/characters', async (req: AuthRequest, res, next) => {
  try {
    const characters = await db.query.characters.findMany({
      where: eq(schema.characters.novelId, req.params.id),
    });

    res.json(characters);
  } catch (error) {
    next(error);
  }
});

// Create character
router.post('/:id/characters', async (req: AuthRequest, res, next) => {
  try {
    const [character] = await db
      .insert(schema.characters)
      .values({
        novelId: req.params.id,
        ...req.body,
      })
      .returning();

    res.status(201).json(character);
  } catch (error) {
    next(error);
  }
});

// Update character
router.patch('/:novelId/characters/:characterId', async (req: AuthRequest, res, next) => {
  try {
    const [character] = await db
      .update(schema.characters)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(schema.characters.id, req.params.characterId))
      .returning();

    res.json(character);
  } catch (error) {
    next(error);
  }
});

// Delete character
router.delete('/:novelId/characters/:characterId', async (req: AuthRequest, res, next) => {
  try {
    await db
      .delete(schema.characters)
      .where(eq(schema.characters.id, req.params.characterId));

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// --- Outline Routes ---

// Get outline versions
router.get('/:id/outline/versions', async (req: AuthRequest, res, next) => {
  try {
    const { outlineService } = await import('../services/outline.service');
    const versions = await outlineService.getVersions(req.params.id);
    res.json(versions);
  } catch (error) {
    next(error);
  }
});

// Stream generate outline
router.get('/:id/generate/outline/stream', async (req: AuthRequest, res, next) => {
  try {
    const { outlineService } = await import('../services/outline.service');
    const { mode, existingOutline } = req.query as any;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await outlineService.generateStream(
      req.params.id,
      req.userId!,
      mode,
      existingOutline,
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Stream generation error:', error);
    if (!res.headersSent) {
      next(error);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Generation failed' })}\n\n`);
      res.end();
    }
  }
});

// Save outline version
router.post('/:id/outline/versions', async (req: AuthRequest, res, next) => {
  try {
    const { outlineService } = await import('../services/outline.service');
    const { content, context, mode } = req.body;
    
    const version = await outlineService.createVersion(
      req.params.id,
      content,
      context,
      mode
    );
    res.status(201).json(version);
  } catch (error) {
    next(error);
  }
});

// Lock/Unlock version
router.patch('/:novelId/outline/versions/:versionId/lock', async (req: AuthRequest, res, next) => {
  try {
    const { outlineService } = await import('../services/outline.service');
    const { isLocked } = req.body;
    const [version] = await outlineService.toggleLock(req.params.versionId, isLocked);
    res.json(version);
  } catch (error) {
    next(error);
  }
});

// Rollback version
router.post('/:id/outline/versions/:versionId/rollback', async (req: AuthRequest, res, next) => {
  try {
    const { outlineService } = await import('../services/outline.service');
    const version = await outlineService.rollback(req.params.id, req.params.versionId);
    res.status(201).json(version);
  } catch (error) {
    next(error);
  }
});

// --- AI Suggestion Routes ---

const getAIConfig = async (userId: string) => {
  const aiConfig = await db.query.aiConfigs.findFirst({
    where: eq(schema.aiConfigs.userId, userId),
  });

  if (!aiConfig) {
    return {
      provider: 'openai' as const,
      model: 'gpt-3.5-turbo',
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL || undefined,
    };
  }

  return {
    provider: aiConfig.provider as 'openai' | 'anthropic' | 'deepseek',
    model: aiConfig.model,
    apiKey: aiConfig.apiKey,
    baseUrl: aiConfig.baseUrl || undefined,
    temperature: 0.7,
  };
};

// Suggest title
router.post('/suggestions/titles', async (req: AuthRequest, res, next) => {
  try {
    const { genre, style, background } = req.body;
    console.log(`[AI] Title suggestion requested for genre: ${genre}, style: ${style}`);
    
    const config = await getAIConfig(req.userId!);
    console.log(`[AI] Using provider: ${config.provider}, model: ${config.model}, baseUrl: ${config.baseUrl || 'default'}`);
    
    const provider = AIProviderFactory.create(config);
    const agent = new TitleAgent(provider);
    
    const startTime = Date.now();
    const response = await agent.execute(
      { novel: { genre, style, background } },
      background || '未提供具体大纲，请根据类型和风格自由发挥'
    );
    const duration = Date.now() - startTime;
    console.log(`[AI] Response received in ${duration}ms`);

    const titles = response.content.split('\n').map(t => t.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    res.json({ title: titles[0] || response.content.trim() });
  } catch (error: any) {
    console.error('[AI] Title suggestion error:', error.message || error);
    next(error);
  }
});

// Expand background
router.post('/suggestions/expand-background', async (req: AuthRequest, res, next) => {
  try {
    const { genre, style, background } = req.body;
    const config = await getAIConfig(req.userId!);
    const provider = AIProviderFactory.create(config);
    const agent = new ConceptExpandAgent(provider);

    const response = await agent.execute(
      { novel: { genre, style } },
      background
    );

    res.json({ background: response.content.trim() });
  } catch (error) {
    next(error);
  }
});

export default router;

