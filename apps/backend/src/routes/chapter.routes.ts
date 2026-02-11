import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { db, schema } from '../database';
import { eq } from 'drizzle-orm';

const router: Router = Router();

// Placeholder routes - to be implemented
router.get('/', async (_req: AuthRequest, res) => {
  res.json([]);
});

// Get single chapter
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const chapter = await db.query.chapters.findFirst({
      where: eq(schema.chapters.id, id),
    });

    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found' });
      return;
    }

    res.json(chapter);
  } catch (error) {
    next(error);
  }
});


// Update chapter
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const [chapter] = await db
      .update(schema.chapters)
      .set({ 
        title, 
        content,
        wordCount: content ? content.length : undefined,
        updatedAt: new Date() 
      })
      .where(eq(schema.chapters.id, id))
      .returning();

    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found' });
      return;
    }

    res.json(chapter);
  } catch (error) {
    next(error);
  }
});


// Delete chapter
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    await db.delete(schema.chapters).where(eq(schema.chapters.id, id));

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
