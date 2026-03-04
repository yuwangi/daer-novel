import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { db, schema } from '../database';
import { eq } from 'drizzle-orm';
import { createAIProvider } from '../services/ai/ai-config';
import {
  OutlineAgent,
  TitleAgent,
  ChapterPlanningAgent,
  ChapterOutlineAgent,
  ChapterDetailAgent,
  ContentAgent,
  ConsistencyAgent,
} from '../services/ai/agents';
import { retrieveRelevantKnowledge } from '../services/embedding';
import { logger } from '../utils/logger';
import { Server } from 'socket.io';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Helper to clean JSON string from Markdown and conversational text
function cleanJson(text: string): string {
  if (!text) return '{}';
  // Remove markdown code blocks
  let content = text.replace(/```(?:json)?|```/gi, '').trim();
  
  // Find JSON start
  const firstOpenBrace = content.indexOf('{');
  const firstOpenBracket = content.indexOf('[');
  
  let startIndex = -1;
  if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
    startIndex = Math.min(firstOpenBrace, firstOpenBracket);
  } else {
    startIndex = Math.max(firstOpenBrace, firstOpenBracket);
  }
  
  if (startIndex !== -1) {
    const lastCloseBrace = content.lastIndexOf('}');
    const lastCloseBracket = content.lastIndexOf(']');
    const endIndex = Math.max(lastCloseBrace, lastCloseBracket);
    
    if (endIndex > startIndex) {
      content = content.substring(startIndex, endIndex + 1);
    }
  }
  
  return content;
}

export const novelQueue = new Queue('novel-generation', { connection });

export interface TaskPayload {
  taskId: string;
  novelId: string;
  chapterId?: string;
  type: string;
  input?: any;
}

export function startWorker(io: Server) {
  const worker = new Worker<TaskPayload>(
    'novel-generation',
    async (job: Job<TaskPayload>) => {
      const { taskId, novelId, chapterId, type, input } = job.data;

      try {
        // Update task status to running
        await db
          .update(schema.tasks)
          .set({ status: 'running', updatedAt: new Date() })
          .where(eq(schema.tasks.id, taskId));

        // Emit progress update
        io.to(`task:${taskId}`).emit('task:progress', {
          taskId,
          status: 'running',
          progress: 0,
        });

        // Get novel and related data
        const novel = await db.query.novels.findFirst({
          where: eq(schema.novels.id, novelId),
        });

        if (!novel) {
          throw new Error('Novel not found');
        }

        const characters = await db.query.characters.findMany({
          where: eq(schema.characters.novelId, novelId),
        });

        // Create AI provider using the shared utility (loads DB config, falls back to env)
        const provider = await createAIProvider(novel.userId);

        let result: any;
        let agent: any;

        // Execute based on task type
        switch (type) {
          case 'outline': {
            agent = new OutlineAgent(provider);
            const kbOutline = await retrieveRelevantKnowledge(novel.title || '大纲', novelId, 5, 0.3);
            result = await agent.execute({ novel, characters, knowledgeBase: kbOutline });
            // Save outline
            await db.insert(schema.outlineVersions).values({
              novelId,
              content: result.content,
              version: 1,
              generationMode: 'initial',
            });
            
            // Update novel current version
            await db.update(schema.novels)
              .set({ currentOutlineVersion: 1 })
              .where(eq(schema.novels.id, novelId));
            break;
          }

          case 'title': {
            agent = new TitleAgent(provider);
            result = await agent.execute({ novel, characters }, input.outline);
            break;
          }

          case 'chapter_planning': {
            agent = new ChapterPlanningAgent(provider);
            const kbPlanning = await retrieveRelevantKnowledge('剧情规划 大纲', novelId, 5, 0.3);
            result = await agent.execute({ novel, characters, knowledgeBase: kbPlanning }, input);
            // Parse and save volumes/chapters
            // First, clear existing volumes (chapters cascade-delete automatically)
            await db.delete(schema.volumes).where(eq(schema.volumes.novelId, novelId));
            const planning = JSON.parse(cleanJson(result.content));
            for (const [vIndex, volume] of planning.volumes.entries()) {
              const [volumeRecord] = await db
                .insert(schema.volumes)
                .values({
                  novelId,
                  title: volume.title,
                  order: vIndex + 1,
                })
                .returning();

              for (const [cIndex, chapter] of volume.chapters.entries()) {
                await db.insert(schema.chapters).values({
                  volumeId: volumeRecord.id,
                  novelId,
                  title: chapter.title,
                  order: cIndex + 1,
                  outline: chapter.summary,
                  status: 'pending',
                });
              }
            }
            break;
          }

          case 'chapter_outline': {
            agent = new ChapterOutlineAgent(provider);
            const chapter = await db.query.chapters.findFirst({
              where: eq(schema.chapters.id, chapterId!),
            });
            const kbChapterOutline = await retrieveRelevantKnowledge(chapter?.title || '章节大纲', novelId, 3, 0.4);
            result = await agent.execute(
              { novel, characters, knowledgeBase: kbChapterOutline },
              { order: chapter?.order, title: chapter?.title, summary: chapter?.outline }
            );
            // Update chapter outline
            await db
              .update(schema.chapters)
              .set({ outline: result.content })
              .where(eq(schema.chapters.id, chapterId!));
            break;
          }

          case 'chapter_detail': {
            agent = new ChapterDetailAgent(provider);
            const chapterForDetail = await db.query.chapters.findFirst({
              where: eq(schema.chapters.id, chapterId!),
            });
            const kbChapterDetail = await retrieveRelevantKnowledge(chapterForDetail?.outline || chapterForDetail?.title || '', novelId, 3, 0.4);
            result = await agent.execute({ novel, characters, knowledgeBase: kbChapterDetail }, chapterForDetail?.outline);
            // Update chapter detail outline
            await db
              .update(schema.chapters)
              .set({ detailOutline: result.content })
              .where(eq(schema.chapters.id, chapterId!));
            break;
          }

          case 'content': {
            agent = new ContentAgent(provider);
            const chapterForContent = await db.query.chapters.findFirst({
              where: eq(schema.chapters.id, chapterId!),
            });

            // Extract input from job data
            const { input } = job.data;
            const targetOutline = input?.modifiedOutline || chapterForContent?.detailOutline || chapterForContent?.outline;
            const instructions = input?.additionalInstructions;
            
            // Stream content generation
            let generatedContent = '';
            const kbContent = await retrieveRelevantKnowledge(targetOutline || chapterForContent?.title || '', novelId, 5, 0.3);
            result = await agent.executeStream(
              { novel, characters, knowledgeBase: kbContent },
              { outline: targetOutline, instructions },
              (chunk: string) => {
                generatedContent += chunk;
                // Emit real-time chunk
                io.to(`task:${taskId}`).emit('task:chunk', { taskId, chunk });
              }
            );

            // Run consistency check
            const consistencyAgent = new ConsistencyAgent(provider);
            const consistencyResult = await consistencyAgent.execute(
              { novel, characters, knowledgeBase: kbContent },
              result.content
            );

            const consistencyCheck = JSON.parse(cleanJson(consistencyResult.content));
            if (!consistencyCheck.passed) {
              throw new Error(`Consistency check failed: ${consistencyCheck.issues.join(', ')}`);
            }

            // Update chapter content
            await db
              .update(schema.chapters)
              .set({
                content: result.content,
                wordCount: result.content.length,
                status: 'completed',
              })
              .where(eq(schema.chapters.id, chapterId!));
            break;
          }

          default:
            throw new Error(`Unknown task type: ${type}`);
        }

        // Update task as completed
        await db
          .update(schema.tasks)
          .set({
            status: 'completed',
            progress: 100,
            result: result,
            metadata: {
              model: result.model,
              tokensUsed: result.tokensUsed,
            },
            updatedAt: new Date(),
          })
          .where(eq(schema.tasks.id, taskId));

        io.to(`task:${taskId}`).emit('task:completed', {
          taskId,
          result,
        });

        // Notify frontend to refresh
        io.emit('novel:updated', { novelId });

        logger.info(`Task ${taskId} completed successfully`);
        return result;
      } catch (error: any) {
        logger.error(`Task ${taskId} failed:`, error);

        // Update task as failed
        await db
          .update(schema.tasks)
          .set({
            status: 'failed',
            error: error.message,
            updatedAt: new Date(),
          })
          .where(eq(schema.tasks.id, taskId));

        io.to(`task:${taskId}`).emit('task:failed', {
          taskId,
          error: error.message,
        });

        throw error;
      }
    },
    { connection }
  );

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed:`, err);
  });

  return worker;
}
