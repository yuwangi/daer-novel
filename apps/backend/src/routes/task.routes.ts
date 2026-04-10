import { Router } from "express";
import { db, schema } from "../database";
import { eq, sql } from "drizzle-orm";
import { AuthRequest } from "../middleware/auth";
import { novelQueue } from "../queue/worker";

const router: Router = Router();

// Generate outline
router.post(
  "/:novelId/generate/outline",
  async (req: AuthRequest, res, next) => {
    try {
      // Create task
      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId: req.params.novelId,
          type: "outline",
          status: "queued",
        })
        .returning();

      // Queue job
      await novelQueue.add(
        "generate-outline",
        {
          taskId: task.id,
          novelId: req.params.novelId,
          type: "outline",
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      res.json(task);
    } catch (error) {
      next(error);
    }
  },
);

// Generate titles
router.post(
  "/:novelId/generate/titles",
  async (req: AuthRequest, res, next) => {
    try {
      const { outline } = req.body;

      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId: req.params.novelId,
          type: "title",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-titles",
        {
          taskId: task.id,
          novelId: req.params.novelId,
          type: "title",
          input: { outline },
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      res.json(task);
    } catch (error) {
      next(error);
    }
  },
);

// Generate volume planning
router.post(
  "/:novelId/generate/volumes",
  async (req: AuthRequest, res, next) => {
    try {
      const { outline } = req.body;

      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId: req.params.novelId,
          type: "volume_planning",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-volumes",
        {
          taskId: task.id,
          novelId: req.params.novelId,
          type: "volume_planning",
          input: {
            outline,
            additionalRequirements: req.body.additionalRequirements,
          },
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      res.json(task);
    } catch (error) {
      next(error);
    }
  },
);

// Generate chapter planning
router.post(
  "/:novelId/generate/chapters",
  async (req: AuthRequest, res, next) => {
    try {
      const { outline, volumeId, additionalRequirements, targetCount } =
        req.body;

      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId: req.params.novelId,
          type: "chapter_planning",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-chapters",
        {
          taskId: task.id,
          novelId: req.params.novelId,
          type: "chapter_planning",
          input: { outline, volumeId, additionalRequirements, targetCount },
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      res.json(task);
    } catch (error) {
      next(error);
    }
  },
);

// Generate chapter content
router.post(
  "/:novelId/chapters/:chapterId/generate",
  async (req: AuthRequest, res, next) => {
    try {
      const { novelId, chapterId } = req.params;

      // Idempotency check: prevent duplicate tasks for the same chapter
      const activeTask = await db
        .select()
        .from(schema.tasks)
        .where(
          sql`${schema.tasks.chapterId} = ${chapterId} 
           AND ${schema.tasks.status} IN ('queued', 'running')`,
        )
        .limit(1);

      if (activeTask.length > 0) {
        res.status(409).json({
          error: "该章节已有正在进行的生成任务",
          taskId: activeTask[0].id,
        });
        return;
      }

      // Also ensure chapter is not already in generating state
      const chapter = await db.query.chapters.findFirst({
        where: eq(schema.chapters.id, chapterId),
      });

      if (chapter?.status === "generating") {
        // Clean up stale state if no active task exists
        await db
          .update(schema.chapters)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(schema.chapters.id, chapterId));
      }

      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId,
          chapterId,
          type: "content",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-content",
        {
          taskId: task.id,
          novelId,
          chapterId,
          type: "content",
          input: req.body,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      res.json(task);
    } catch (error) {
      next(error);
    }
  },
);

// Reset chapter status manually
router.post(
  "/:novelId/chapters/:chapterId/reset",
  async (req: AuthRequest, res, next) => {
    try {
      const { chapterId } = req.params;

      // Cancel any active tasks for this chapter
      await db
        .update(schema.tasks)
        .set({
          status: "cancelled",
          error: "User manually reset chapter status",
          updatedAt: new Date(),
        })
        .where(
          sql`${schema.tasks.chapterId} = ${chapterId} 
           AND ${schema.tasks.status} IN ('queued', 'running')`,
        );

      // Reset chapter status
      const [updatedChapter] = await db
        .update(schema.chapters)
        .set({
          status: "pending",
          updatedAt: new Date(),
        })
        .where(eq(schema.chapters.id, chapterId))
        .returning();

      if (!updatedChapter) {
        res.status(404).json({ error: "Chapter not found" });
        return;
      }

      res.json({
        success: true,
        chapter: updatedChapter,
        message: "章节状态已重置，可以重新生成",
      });
    } catch (error) {
      next(error);
    }
  },
);

// Update a Volume (title + summary)
router.patch(
  "/:novelId/volumes/:volumeId",
  async (req: AuthRequest, res, next) => {
    try {
      const { volumeId } = req.params;
      const { title, summary } = req.body;
      const updated = await db
        .update(schema.volumes)
        .set({ title, summary })
        .where(eq(schema.volumes.id, volumeId))
        .returning();
      res.json(updated[0]);
    } catch (error) {
      next(error);
    }
  },
);

// Delete a Volume (chapters cascade)
router.delete(
  "/:novelId/volumes/:volumeId",
  async (req: AuthRequest, res, next) => {
    try {
      const { volumeId } = req.params;
      await db.delete(schema.volumes).where(eq(schema.volumes.id, volumeId));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

// Batch Save Volumes
router.post("/:novelId/volumes/batch", async (req: AuthRequest, res, next) => {
  try {
    const { novelId } = req.params;
    const { volumes: newVolumes } = req.body;

    // Clear existing volumes (chapters and other relations cascade delete)
    await db.delete(schema.volumes).where(eq(schema.volumes.novelId, novelId));

    if (!newVolumes || newVolumes.length === 0) {
      return res.json([]);
    }

    const insertedVolumes = await db
      .insert(schema.volumes)
      .values(
        newVolumes.map((vol: any, index: number) => ({
          id: crypto.randomUUID(),
          novelId,
          title: vol.title,
          summary: vol.summary || "",
          order: index + 1,
        })),
      )
      .returning();

    return res.json(insertedVolumes);
  } catch (error) {
    return next(error);
  }
});

// Batch Save Chapters
router.post(
  "/:novelId/volumes/:volumeId/chapters/batch",
  async (req: AuthRequest, res, next) => {
    try {
      const { novelId, volumeId } = req.params;
      const { chapters: newChapters } = req.body;

      const lastChapter = await db.query.chapters.findFirst({
        where: eq(schema.chapters.volumeId, volumeId),
        orderBy: (chapters, { desc }) => [desc(chapters.order)],
      });

      let startOrder = (lastChapter?.order || 0) + 1;

      const insertedChapters = await db
        .insert(schema.chapters)
        .values(
          newChapters.map((ch: any, index: number) => ({
            id: crypto.randomUUID(),
            volumeId,
            novelId,
            title: ch.title,
            outline: ch.summary,
            order: startOrder + index,
            status: "pending",
          })),
        )
        .returning();

      res.json(insertedChapters);
    } catch (error) {
      next(error);
    }
  },
);

// Get task status
router.get("/tasks/:taskId", async (req: AuthRequest, res, next) => {
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
