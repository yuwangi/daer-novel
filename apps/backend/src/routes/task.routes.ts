import { Router } from "express";
import { db, schema } from "../database";
import { eq, and, inArray } from "drizzle-orm";
import { AuthRequest } from "../middleware/auth";
import { novelQueue, connection } from "../queue/worker";

const router: Router = Router();

async function checkAndSetIdempotentLock(
  key: string,
  ttlSeconds: number = 3600,
): Promise<boolean> {
  const result = await connection.set(
    `idempotent:${key}`,
    "1",
    "EX",
    ttlSeconds,
    "NX",
  );
  return result === "OK";
}

async function releaseIdempotentLock(key: string): Promise<void> {
  await connection.del(`idempotent:${key}`);
}

async function hasActiveTask(
  novelId: string,
  taskType: (typeof schema.tasks.type.enumValues)[number],
  chapterId?: string,
): Promise<boolean> {
  const whereConditions = [
    eq(schema.tasks.novelId, novelId),
    eq(schema.tasks.type, taskType),
    inArray(schema.tasks.status, ["queued", "running"]),
  ];

  if (chapterId) {
    whereConditions.push(eq(schema.tasks.chapterId, chapterId));
  }

  const existingTask = await db.query.tasks.findFirst({
    where: and(...whereConditions),
  });

  return !!existingTask;
}

// Generate outline
router.post(
  "/:novelId/generate/outline",
  async (req: AuthRequest, res, next) => {
    try {
      const { novelId } = req.params;
      const lockKey = `outline:${novelId}`;

      if (!(await checkAndSetIdempotentLock(lockKey))) {
        res.status(409).json({
          error: "该小说的大纲生成任务已在处理中",
        });
        return;
      }

      if (await hasActiveTask(novelId, "outline")) {
        await releaseIdempotentLock(lockKey);
        res.status(409).json({
          error: "该小说的大纲生成任务已在队列中",
        });
        return;
      }

      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId,
          type: "outline",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-outline",
        {
          taskId: task.id,
          novelId,
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
      const { novelId } = req.params;
      const { outline } = req.body;
      const lockKey = `titles:${novelId}`;

      if (!(await checkAndSetIdempotentLock(lockKey))) {
        res.status(409).json({
          error: "该小说的标题生成任务已在处理中",
        });
        return;
      }

      if (await hasActiveTask(novelId, "title")) {
        await releaseIdempotentLock(lockKey);
        res.status(409).json({
          error: "该小说的标题生成任务已在队列中",
        });
        return;
      }

      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId,
          type: "title",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-titles",
        {
          taskId: task.id,
          novelId,
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
      const { novelId } = req.params;
      const { outline } = req.body;
      const lockKey = `volumes:${novelId}`;

      if (!(await checkAndSetIdempotentLock(lockKey))) {
        res.status(409).json({
          error: "该小说的分卷规划任务已在处理中",
        });
        return;
      }

      if (await hasActiveTask(novelId, "volume_planning")) {
        await releaseIdempotentLock(lockKey);
        res.status(409).json({
          error: "该小说的分卷规划任务已在队列中",
        });
        return;
      }

      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId,
          type: "volume_planning",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-volumes",
        {
          taskId: task.id,
          novelId,
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
      const { novelId } = req.params;
      const { outline, volumeId, additionalRequirements, targetCount } =
        req.body;
      const lockKey = `chapters:${volumeId}`;

      if (!(await checkAndSetIdempotentLock(lockKey))) {
        res.status(409).json({
          error: "该分卷的章节规划任务已在处理中",
        });
        return;
      }

      if (await hasActiveTask(novelId, "chapter_planning")) {
        await releaseIdempotentLock(lockKey);
        res.status(409).json({
          error: "该分卷的章节规划任务已在队列中",
        });
        return;
      }

      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId,
          type: "chapter_planning",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-chapters",
        {
          taskId: task.id,
          novelId,
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
      const lockKey = `content:${chapterId}`;

      if (!(await checkAndSetIdempotentLock(lockKey))) {
        res.status(409).json({
          error: "该章节的内容生成任务已在处理中",
        });
        return;
      }

      if (await hasActiveTask(novelId, "content", chapterId)) {
        await releaseIdempotentLock(lockKey);
        res.status(409).json({
          error: "该章节的内容生成任务已在队列中",
        });
        return;
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
