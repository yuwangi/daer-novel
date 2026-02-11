import { Router } from 'express';
import { db, schema } from '../database';
import { eq } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth';
import { novelQueue } from '../queue/worker';

const router: Router = Router();

// Generate outline
router.post('/:novelId/generate/outline', async (req: AuthRequest, res, next) => {
  try {
    // Create task
    const [task] = await db
      .insert(schema.tasks)
      .values({
        novelId: req.params.novelId,
        type: 'outline',
        status: 'queued',
      })
      .returning();

    // Queue job
    await novelQueue.add('generate-outline', {
      taskId: task.id,
      novelId: req.params.novelId,
      type: 'outline',
    });

    res.json(task);
  } catch (error) {
    next(error);
  }
});

// Generate titles
router.post('/:novelId/generate/titles', async (req: AuthRequest, res, next) => {
  try {
    const { outline } = req.body;

    const [task] = await db
      .insert(schema.tasks)
      .values({
        novelId: req.params.novelId,
        type: 'title',
        status: 'queued',
      })
      .returning();

    await novelQueue.add('generate-titles', {
      taskId: task.id,
      novelId: req.params.novelId,
      type: 'title',
      input: { outline },
    });

    res.json(task);
  } catch (error) {
    next(error);
  }
});

// Generate chapter planning
router.post('/:novelId/generate/chapters', async (req: AuthRequest, res, next) => {
  try {
    const { outline, additionalRequirements } = req.body;

    const [task] = await db
      .insert(schema.tasks)
      .values({
        novelId: req.params.novelId,
        type: 'chapter_planning',
        status: 'queued',
      })
      .returning();

    await novelQueue.add('generate-chapters', {
      taskId: task.id,
      novelId: req.params.novelId,
      type: 'chapter_planning',
      input: { outline, additionalRequirements },
    });

    res.json(task);
  } catch (error) {
    next(error);
  }
});

// Generate chapter content
router.post('/:novelId/chapters/:chapterId/generate', async (req: AuthRequest, res, next) => {
  try {
    const [task] = await db
      .insert(schema.tasks)
      .values({
        novelId: req.params.novelId,
        chapterId: req.params.chapterId,
        type: 'content',
        status: 'queued',
      })
      .returning();

    await novelQueue.add('generate-content', {
      taskId: task.id,
      novelId: req.params.novelId,
      chapterId: req.params.chapterId,
      type: 'content',
    });

    res.json(task);
  } catch (error) {
    next(error);
  }
});


// Get task status
router.get('/tasks/:taskId', async (req: AuthRequest, res, next) => {
  try {
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, req.params.taskId),
    });

    res.json(task);
  } catch (error) {
    next(error);
  }
});

export default router;
