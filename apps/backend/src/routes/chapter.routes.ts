import { Router } from "express";
import { AuthRequest } from "../middleware/auth";
import { db, schema } from "../database";
import { eq, desc } from "drizzle-orm";
import { createAIProvider } from "../services/ai/ai-config";
import { OocAgent } from "../services/ai/agents";

const router: Router = Router();

// Maximum number of snapshots per chapter
const MAX_SNAPSHOTS = 30;

/**
 * Enforce snapshot limit for a chapter - deletes oldest snapshots if over limit
 * This should be called BEFORE inserting a new snapshot
 * Ensures that after insertion, there will be at most MAX_SNAPSHOTS snapshots
 */
async function enforceSnapshotLimit(chapterId: string): Promise<void> {
  const existing = await db.query.chapterSnapshots.findMany({
    where: eq(schema.chapterSnapshots.chapterId, chapterId),
    orderBy: [desc(schema.chapterSnapshots.createdAt)],
  });

  // Calculate how many to delete: if we have 30 or more, we need to delete enough
  // to make room for the new one, keeping at most MAX_SNAPSHOTS - 1 existing ones
  // After insertion, total will be at most MAX_SNAPSHOTS
  if (existing.length >= MAX_SNAPSHOTS) {
    const numToKeep = MAX_SNAPSHOTS - 1; // Keep room for the new snapshot
    const toDelete = existing.slice(numToKeep);
    for (const snap of toDelete) {
      await db
        .delete(schema.chapterSnapshots)
        .where(eq(schema.chapterSnapshots.id, snap.id));
    }
  }
}

// ========= Analysis & Checking Routes =========

// POST /chapters/:id/ooc-check - Check text for out-of-character behavior
router.post("/:id/ooc-check", async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!content) {
      res.status(400).json({ error: "Missing content to check" });
      return;
    }

    // 1. Get Chapter and Novel context
    const chapter = await db.query.chapters.findFirst({
      where: eq(schema.chapters.id, id),
    });

    if (!chapter) {
      res.status(404).json({ error: "Chapter not found" });
      return;
    }

    const novel = await db.query.novels.findFirst({
      where: eq(schema.novels.id, chapter.novelId),
    });

    if (!novel) {
      res.status(404).json({ error: "Novel not found" });
      return;
    }

    // 2. Get Characters
    const characters = await db.query.characters.findMany({
      where: eq(schema.characters.novelId, novel.id),
    });

    // 4. Initialize Agent and execute
    const provider = await createAIProvider(userId!);
    const agent = new OocAgent(provider);

    const result = await agent.execute({ novel, characters }, content);

    // Parse result JSON (we use a cleaner helper if available, but for now just parse)
    let parsedResult;
    try {
      let cleanContent = result.content
        .replace(/```(?:json)?|```/gi, "")
        .trim();
      parsedResult = JSON.parse(cleanContent);
    } catch (e) {
      parsedResult = { passed: false, issues: ["无法解析 AI 的返回结果"] };
    }

    res.json(parsedResult);
  } catch (error) {
    next(error);
  }
});

// List chapters (stub)
router.get("/", async (_req: AuthRequest, res) => {
  res.json([]);
});

// Get single chapter
router.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const chapter = await db.query.chapters.findFirst({
      where: eq(schema.chapters.id, id),
    });

    if (!chapter) {
      res.status(404).json({ error: "Chapter not found" });
      return;
    }

    res.json(chapter);
  } catch (error) {
    next(error);
  }
});

// Update chapter
router.patch("/:id", async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, outline } = req.body;

    const [chapter] = await db
      .update(schema.chapters)
      .set({
        title,
        content,
        outline,
        wordCount: content ? content.length : undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.chapters.id, id))
      .returning();

    if (!chapter) {
      res.status(404).json({ error: "Chapter not found" });
      return;
    }

    res.json(chapter);
  } catch (error) {
    next(error);
  }
});

// Delete chapter
router.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await db.delete(schema.chapters).where(eq(schema.chapters.id, id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ========= Snapshot (Version History) Routes =========

// GET /chapters/:id/snapshots - list all snapshots (without content for speed)
router.get("/:id/snapshots", async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const snapshots = await db.query.chapterSnapshots.findMany({
      where: eq(schema.chapterSnapshots.chapterId, id),
      orderBy: [desc(schema.chapterSnapshots.createdAt)],
      columns: {
        id: true,
        chapterId: true,
        novelId: true,
        title: true,
        wordCount: true,
        label: true,
        createdAt: true,
        // Exclude content from list
      },
    });
    res.json(snapshots);
  } catch (error) {
    next(error);
  }
});

// POST /chapters/:id/snapshots - create a manual snapshot
router.post("/:id/snapshots", async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { label } = req.body;

    const chapter = await db.query.chapters.findFirst({
      where: eq(schema.chapters.id, id),
    });
    if (!chapter || !chapter.content) {
      res.status(404).json({ error: "Chapter not found or empty" });
      return;
    }

    // Enforce snapshot limit before creating new one
    await enforceSnapshotLimit(id);

    const [snapshot] = await db
      .insert(schema.chapterSnapshots)
      .values({
        chapterId: id,
        novelId: chapter.novelId,
        content: chapter.content,
        title: chapter.title,
        wordCount: chapter.wordCount ?? 0,
        label: label ?? "手动快照",
      })
      .returning();

    res.status(201).json(snapshot);
  } catch (error) {
    next(error);
  }
});

// GET /chapters/:id/snapshots/:snapshotId - get single snapshot with content
router.get(
  "/:id/snapshots/:snapshotId",
  async (req: AuthRequest, res, next) => {
    try {
      const { snapshotId } = req.params;
      const snapshot = await db.query.chapterSnapshots.findFirst({
        where: eq(schema.chapterSnapshots.id, snapshotId),
      });
      if (!snapshot) {
        res.status(404).json({ error: "Snapshot not found" });
        return;
      }
      res.json(snapshot);
    } catch (error) {
      next(error);
    }
  },
);

// POST /chapters/:id/snapshots/:snapshotId/restore - restore a snapshot
router.post(
  "/:id/snapshots/:snapshotId/restore",
  async (req: AuthRequest, res, next) => {
    try {
      const { id, snapshotId } = req.params;

      const snapshot = await db.query.chapterSnapshots.findFirst({
        where: eq(schema.chapterSnapshots.id, snapshotId),
      });
      if (!snapshot) {
        res.status(404).json({ error: "Snapshot not found" });
        return;
      }

      // Auto-save current state as snapshot before restoring
      const currentChapter = await db.query.chapters.findFirst({
        where: eq(schema.chapters.id, id),
      });
      if (currentChapter?.content) {
        // Enforce snapshot limit before creating auto-save snapshot
        await enforceSnapshotLimit(id);

        await db.insert(schema.chapterSnapshots).values({
          chapterId: id,
          novelId: currentChapter.novelId,
          content: currentChapter.content,
          title: currentChapter.title,
          wordCount: currentChapter.wordCount ?? 0,
          label: "还原前自动保存",
        });
      }

      // Restore snapshot content
      const [updated] = await db
        .update(schema.chapters)
        .set({
          content: snapshot.content,
          wordCount: snapshot.wordCount,
          updatedAt: new Date(),
        })
        .where(eq(schema.chapters.id, id))
        .returning();

      res.json({ chapter: updated, snapshot });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /chapters/:id/snapshots/:snapshotId - delete a snapshot
router.delete(
  "/:id/snapshots/:snapshotId",
  async (req: AuthRequest, res, next) => {
    try {
      const { snapshotId } = req.params;
      await db
        .delete(schema.chapterSnapshots)
        .where(eq(schema.chapterSnapshots.id, snapshotId));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

export default router;
