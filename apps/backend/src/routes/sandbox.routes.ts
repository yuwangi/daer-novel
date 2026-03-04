import { Router, Request, Response } from 'express';
import { db, schema } from '../database';
import { eq } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth';
import { createAIProvider } from '../services/ai/ai-config';
import { SandboxAgent } from '../services/ai/agents';

const router: Router = Router();


// ── List all sandboxes for a novel ───────────────────────────────
router.get('/novels/:novelId/sandboxes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { novelId } = req.params;
    const sandboxes = await db
      .select()
      .from(schema.plotSandboxes)
      .where(eq(schema.plotSandboxes.novelId, novelId))
      .orderBy(schema.plotSandboxes.createdAt);
    res.json({ sandboxes });
  } catch (error) {
    console.error('List sandboxes error:', error);
    res.status(500).json({ error: '获取推演沙盒列表失败' });
  }
});

// ── Create a new sandbox ─────────────────────────────────────────
router.post('/novels/:novelId/sandboxes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { novelId } = req.params;
    const { title, premise } = req.body;

    if (!title || !premise) {
      res.status(400).json({ error: '标题和前提假设不能为空' });
      return;
    }

    const [sandbox] = await db
      .insert(schema.plotSandboxes)
      .values({ novelId, title, premise })
      .returning();

    res.status(201).json({ sandbox });
  } catch (error) {
    console.error('Create sandbox error:', error);
    res.status(500).json({ error: '创建推演沙盒失败' });
  }
});

// ── Update a sandbox (title, premise, or content) ────────────────
router.patch('/sandboxes/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, premise, content } = req.body;

    const [updated] = await db
      .update(schema.plotSandboxes)
      .set({
        ...(title !== undefined && { title }),
        ...(premise !== undefined && { premise }),
        ...(content !== undefined && { content }),
        updatedAt: new Date(),
      })
      .where(eq(schema.plotSandboxes.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: '推演沙盒不存在' });
      return;
    }

    res.json({ sandbox: updated });
  } catch (error) {
    console.error('Update sandbox error:', error);
    res.status(500).json({ error: '更新推演沙盒失败' });
  }
});

// ── Delete a sandbox ─────────────────────────────────────────────
router.delete('/sandboxes/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db
      .delete(schema.plotSandboxes)
      .where(eq(schema.plotSandboxes.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete sandbox error:', error);
    res.status(500).json({ error: '删除推演沙盒失败' });
  }
});

// ── AI Generate plot developments for a sandbox ──────────────────
router.post('/sandboxes/:id/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).user?.id;

    if (!userId) {
      res.status(401).json({ error: '未授权' });
      return;
    }

    // Fetch the sandbox
    const [sandbox] = await db
      .select()
      .from(schema.plotSandboxes)
      .where(eq(schema.plotSandboxes.id, id));

    if (!sandbox) {
      res.status(404).json({ error: '推演沙盒不存在' });
      return;
    }

    // Fetch novel context
    const novel = await db.query.novels.findFirst({
      where: eq(schema.novels.id, sandbox.novelId),
    });

    if (!novel) {
      res.status(404).json({ error: '小说不存在' });
      return;
    }

    // Fetch characters for context
    const characters = await db
      .select()
      .from(schema.characters)
      .where(eq(schema.characters.novelId, sandbox.novelId));

    // Get AI provider
    const provider = await createAIProvider(userId);
    const agent = new SandboxAgent(provider);

    const response = await agent.execute(
      { novel, characters },
      { premise: sandbox.premise, existingContent: sandbox.content || undefined }
    );

    // Save the generated content back to the sandbox
    const [updated] = await db
      .update(schema.plotSandboxes)
      .set({ content: response.content, updatedAt: new Date() })
      .where(eq(schema.plotSandboxes.id, id))
      .returning();

    res.json({ sandbox: updated, content: response.content });
  } catch (error) {
    console.error('Generate sandbox error:', error);
    res.status(500).json({ error: '推演生成失败，请稍后重试' });
  }
});

export default router;
