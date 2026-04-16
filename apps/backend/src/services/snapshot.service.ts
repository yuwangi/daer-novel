import { db, schema } from "../database";
import { eq, desc } from "drizzle-orm";

const MAX_SNAPSHOTS_PER_CHAPTER = 30;

export async function enforceSnapshotLimit(chapterId: string): Promise<void> {
  const existing = await db.query.chapterSnapshots.findMany({
    where: eq(schema.chapterSnapshots.chapterId, chapterId),
    orderBy: [desc(schema.chapterSnapshots.createdAt)],
  });

  if (existing.length >= MAX_SNAPSHOTS_PER_CHAPTER) {
    const toDelete = existing.slice(MAX_SNAPSHOTS_PER_CHAPTER - 1);
    for (const snap of toDelete) {
      await db
        .delete(schema.chapterSnapshots)
        .where(eq(schema.chapterSnapshots.id, snap.id));
    }
  }
}

export async function createSnapshot(
  chapterId: string,
  novelId: string,
  content: string,
  title: string,
  wordCount: number,
  label: string,
): Promise<any> {
  await enforceSnapshotLimit(chapterId);

  const [snapshot] = await db
    .insert(schema.chapterSnapshots)
    .values({
      chapterId,
      novelId,
      content,
      title,
      wordCount,
      label,
    })
    .returning();

  return snapshot;
}
