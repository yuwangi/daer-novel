import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { db, schema } from '../database';
import { eq } from 'drizzle-orm';
import { AIProviderFactory, AIProviderConfig } from '../services/ai/providers';
import { AssistAgent } from '../services/ai/agents';

const router: Router = Router();

// Chat with AI Assistant
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { novelId, message, previousContent } = req.body;
    const userId = req.user?.id;

    if (!novelId || !message) {
      res.status(400).json({ error: 'Missing novelId or message' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // 1. Get Novel Context
    const novel = await db.query.novels.findFirst({
      where: eq(schema.novels.id, novelId),
    });

    if (!novel) {
      res.status(404).json({ error: 'Novel not found' });
      return;
    }

    // 2. Get Characters
    const characters = await db.query.characters.findMany({
      where: eq(schema.characters.novelId, novelId),
    });

    // 3. Get AI Config
    // Try to find config for this user
    let aiConfig = await db.query.aiConfigs.findFirst({
      where: eq(schema.aiConfigs.userId, userId),
    });

    // If no config found, check if there is a system default or error out
    if (!aiConfig) {
      // For now, return error. In production, might want a global default.
      res.status(400).json({ error: 'AI Configuration not found. Please configure AI settings first.' });
      return;
    }

    // 4. Initialize Agent
    const providerConfig: AIProviderConfig = {
      provider: aiConfig.provider as any,
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
      baseUrl: aiConfig.baseUrl || undefined,
      temperature: 0.7, // Default for assistant
    };

    const provider = AIProviderFactory.create(providerConfig);
    const agent = new AssistAgent(provider);

    // 5. Stream Response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      await agent.executeStream(
        {
          novel,
          characters,
          previousContent
        },
        { message, previousContent },
        (chunk) => {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
      );
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error) {
      console.error('Stream error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
      res.end();
    }

  } catch (error) {
    next(error);
  }
});

export default router;
