import { Router } from 'express';
import { db, schema } from '../database';
import { eq } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth';

const router: Router = Router();

// Get AI configs
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const configs = await db.query.aiConfigs.findMany({
      where: eq(schema.aiConfigs.userId, req.userId!),
    });

    res.json(configs);
  } catch (error) {
    next(error);
  }
});

// Create AI config
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const [config] = await db
      .insert(schema.aiConfigs)
      .values({
        userId: req.userId!,
        ...req.body,
      })
      .returning();

    res.status(201).json(config);
  } catch (error) {
    next(error);
  }
});

// Update AI config
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const [config] = await db
      .update(schema.aiConfigs)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(schema.aiConfigs.id, req.params.id))
      .returning();

    res.json(config);
  } catch (error) {
    next(error);
  }
});

// Delete AI config
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await db.delete(schema.aiConfigs).where(eq(schema.aiConfigs.id, req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
