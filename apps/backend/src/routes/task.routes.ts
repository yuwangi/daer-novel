import { Router } from "express";
import { db, schema } from "../database";
import { eq } from "drizzle-orm";
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
      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId: req.params.novelId,
          chapterId: req.params.chapterId,
          type: "content",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-content",
        {
          taskId: task.id,
          novelId: req.params.novelId,
          chapterId: req.params.chapterId,
          type: "content",
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

// Sync task status - check for stale tasks and update chapter status
router.post("/sync", async (_req: AuthRequest, res, next) => {
  try {
    // Find all tasks that are still running or queued
    const activeTasks = await db.query.tasks.findMany({
      where: (tasks, { inArray }) =>
        inArray(tasks.status, ["running", "queued"]),
    });

    const syncResults: {
      taskId: string;
      oldStatus: string | null;
      newStatus: string;
      chapterId?: string | null;
    }[] = [];

    // Check each active task
    for (const task of activeTasks) {
      // Check if the task has been running for more than 10 minutes (stale)
      const taskAge = Date.now() - new Date(task.updatedAt).getTime();
      const isStale = taskAge > 10 * 60 * 1000; // 10 minutes

      if (isStale) {
        // Mark task as failed
        await db
          .update(schema.tasks)
          .set({
            status: "failed",
            error: "Task timeout - browser disconnected",
            updatedAt: new Date(),
          })
          .where(eq(schema.tasks.id, task.id));

        // If task has a chapter, update chapter status
        if (task.chapterId) {
          await db
            .update(schema.chapters)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(schema.chapters.id, task.chapterId));
        }

        syncResults.push({
          taskId: task.id,
          oldStatus: task.status,
          newStatus: "failed",
          chapterId: task.chapterId,
        });
      }
    }

    // Also check for chapters stuck in "generating" status without active tasks
    const generatingChapters = await db.query.chapters.findMany({
      where: eq(schema.chapters.status, "generating"),
    });

    for (const chapter of generatingChapters) {
      // Check if there's an active task for this chapter
      const activeTask = await db.query.tasks.findFirst({
        where: (tasks, { and, eq, inArray }) =>
          and(
            eq(tasks.chapterId, chapter.id),
            inArray(tasks.status, ["running", "queued"]),
          ),
      });

      if (!activeTask) {
        // No active task, reset chapter status to pending
        await db
          .update(schema.chapters)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(schema.chapters.id, chapter.id));

        syncResults.push({
          taskId: "none",
          oldStatus: "generating",
          newStatus: "pending",
          chapterId: chapter.id,
        });
      }
    }

    res.json({
      synced: syncResults.length,
      details: syncResults,
    });
  } catch (error) {
    next(error);
  }
});

// Get active tasks for a novel
router.get("/:novelId/tasks/active", async (req: AuthRequest, res, next) => {
  try {
    const { novelId } = req.params;

    const activeTasks = await db.query.tasks.findMany({
      where: (tasks, { and, eq, inArray }) =>
        and(
          eq(tasks.novelId, novelId),
          inArray(tasks.status, ["running", "queued"]),
        ),
      with: {
        chapter: true,
      },
    });

    res.json(activeTasks);
  } catch (error) {
    next(error);
  }
});

export default router;
