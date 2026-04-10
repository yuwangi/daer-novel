import { Router } from "express";
import { db, schema } from "../database";
import { eq, and, sql } from "drizzle-orm";
import { AuthRequest } from "../middleware/auth";
import { novelQueue } from "../queue/worker";

const router: Router = Router();

// 任务类型分组定义 - 用于幂等性检查
const TASK_TYPE_GROUPS = {
  // 小说级别的任务 - 同一小说同一时间只能有一个进行中的任务
  novelLevel: ["outline", "title", "volume_planning"] as const,
  // 分卷级别的任务
  volumeLevel: ["chapter_planning"] as const,
  // 章节级别的任务 - 同一章节同一时间只能有一个进行中的任务
  chapterLevel: [
    "chapter_outline",
    "chapter_detail",
    "content",
    "consistency_check",
  ] as const,
};

/**
 * 检查是否存在进行中的相同类型任务
 * @param novelId 小说ID
 * @param type 任务类型
 * @param chapterId 章节ID（可选）
 * @returns 存在则返回任务ID，否则返回null
 */
async function checkExistingTask(
  novelId: string,
  type: string,
  chapterId?: string,
): Promise<string | null> {
  // 使用 SQL 查询来避免类型问题
  const conditions = [
    eq(schema.tasks.novelId, novelId),
    eq(schema.tasks.type, type as any),
    sql`${schema.tasks.status} IN ('queued', 'running')`,
  ];

  if (chapterId) {
    conditions.push(eq(schema.tasks.chapterId, chapterId));
  }

  const existingTask = await db.query.tasks.findFirst({
    where: and(...conditions),
    orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
  });

  return existingTask?.id || null;
}

/**
 * 检查小说级别任务是否存在冲突
 * 某些任务类型（如大纲生成）应该互斥
 */
async function checkNovelLevelConflict(
  novelId: string,
  type: string,
): Promise<string | null> {
  // 检查是否属于 novelLevel 组
  if (TASK_TYPE_GROUPS.novelLevel.includes(type as any)) {
    // 检查该小说是否有任何 novelLevel 任务在进行中
    const existingTask = await db.query.tasks.findFirst({
      where: and(
        eq(schema.tasks.novelId, novelId),
        sql`${schema.tasks.type} IN ('outline', 'title', 'volume_planning')`,
        sql`${schema.tasks.status} IN ('queued', 'running')`,
      ),
      orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
    });
    return existingTask?.id || null;
  }
  return null;
}

// Generate outline
router.post(
  "/:novelId/generate/outline",
  async (req: AuthRequest, res, next) => {
    try {
      const novelId = req.params.novelId;

      // 幂等性检查：检查是否已有进行中的大纲生成任务
      const existingTaskId = await checkNovelLevelConflict(novelId, "outline");
      if (existingTaskId) {
        const existingTask = await db.query.tasks.findFirst({
          where: eq(schema.tasks.id, existingTaskId),
        });
        res.status(409).json({
          error: "已有进行中的生成任务",
          message: "该小说已有进行中的大纲生成任务，请等待完成后再试",
          task: existingTask,
        });
        return;
      }

      // Create task
      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId: novelId,
          type: "outline",
          status: "queued",
        })
        .returning();

      // Queue job
      await novelQueue.add(
        "generate-outline",
        {
          taskId: task.id,
          novelId: novelId,
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
      const novelId = req.params.novelId;
      const { outline } = req.body;

      // 幂等性检查
      const existingTaskId = await checkNovelLevelConflict(novelId, "title");
      if (existingTaskId) {
        const existingTask = await db.query.tasks.findFirst({
          where: eq(schema.tasks.id, existingTaskId),
        });
        res.status(409).json({
          error: "已有进行中的生成任务",
          message: "该小说已有进行中的标题生成任务，请等待完成后再试",
          task: existingTask,
        });
        return;
      }

      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId: novelId,
          type: "title",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-titles",
        {
          taskId: task.id,
          novelId: novelId,
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
      const novelId = req.params.novelId;
      const { outline } = req.body;

      // 幂等性检查
      const existingTaskId = await checkNovelLevelConflict(
        novelId,
        "volume_planning",
      );
      if (existingTaskId) {
        const existingTask = await db.query.tasks.findFirst({
          where: eq(schema.tasks.id, existingTaskId),
        });
        res.status(409).json({
          error: "已有进行中的生成任务",
          message: "该小说已有进行中的分卷规划任务，请等待完成后再试",
          task: existingTask,
        });
        return;
      }

      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId: novelId,
          type: "volume_planning",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-volumes",
        {
          taskId: task.id,
          novelId: novelId,
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
      const novelId = req.params.novelId;
      const { outline, volumeId, additionalRequirements, targetCount } =
        req.body;

      // 幂等性检查：检查是否已有进行中的章节规划任务
      const existingTaskId = await checkExistingTask(
        novelId,
        "chapter_planning",
      );
      if (existingTaskId) {
        const existingTask = await db.query.tasks.findFirst({
          where: eq(schema.tasks.id, existingTaskId),
        });
        res.status(409).json({
          error: "已有进行中的生成任务",
          message: "该小说已有进行中的章节规划任务，请等待完成后再试",
          task: existingTask,
        });
        return;
      }

      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId: novelId,
          type: "chapter_planning",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-chapters",
        {
          taskId: task.id,
          novelId: novelId,
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
      const novelId = req.params.novelId;
      const chapterId = req.params.chapterId;

      // 幂等性检查：检查该章节是否已有进行中的内容生成任务
      const existingTaskId = await checkExistingTask(
        novelId,
        "content",
        chapterId,
      );
      if (existingTaskId) {
        const existingTask = await db.query.tasks.findFirst({
          where: eq(schema.tasks.id, existingTaskId),
        });
        res.status(409).json({
          error: "已有进行中的生成任务",
          message: "该章节已有进行中的内容生成任务，请等待完成后再试",
          task: existingTask,
        });
        return;
      }

      const [task] = await db
        .insert(schema.tasks)
        .values({
          novelId: novelId,
          chapterId: chapterId,
          type: "content",
          status: "queued",
        })
        .returning();

      await novelQueue.add(
        "generate-content",
        {
          taskId: task.id,
          novelId: novelId,
          chapterId: chapterId,
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
