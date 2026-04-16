import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { db, schema } from "../database";
import { eq, desc } from "drizzle-orm";
import { createAIProvider } from "../services/ai/ai-config";
import {
  OutlineAgent,
  TitleAgent,
  VolumePlanningAgent,
  ChapterPlanningAgent,
  ChapterDetailAgent,
  ContentAgent,
  ConsistencyAgent,
} from "../services/ai/agents";
import { retrieveRelevantKnowledge } from "../services/embedding";
import { logger } from "../utils/logger";
import { Server } from "socket.io";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});

// Helper to clean JSON string from Markdown and conversational text
function cleanJson(text: string): string {
  if (!text) return "{}";

  let content = text.trim();

  // Remove markdown code blocks if present
  const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  const match = markdownRegex.exec(content);
  if (match && match[1]) {
    content = match[1].trim();
  } else {
    // If no code blocks, try to find the start and end of JSON
    const firstOpenBrace = content.indexOf("{");
    const firstOpenBracket = content.indexOf("[");

    let startIndex = -1;
    if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
      startIndex = Math.min(firstOpenBrace, firstOpenBracket);
    } else if (firstOpenBrace !== -1) {
      startIndex = firstOpenBrace;
    } else if (firstOpenBracket !== -1) {
      startIndex = firstOpenBracket;
    }

    if (startIndex !== -1) {
      const lastCloseBrace = content.lastIndexOf("}");
      const lastCloseBracket = content.lastIndexOf("]");
      const endIndex = Math.max(lastCloseBrace, lastCloseBracket);

      if (endIndex > startIndex) {
        content = content.substring(startIndex, endIndex + 1);
      }
    }
  }

  // Final cleanup of common LLM artifacts
  content = content.replace(/[\u200B-\u200D\uFEFF]/g, ""); // Remove zero-width spaces

  return content;
}

export const novelQueue = new Queue("novel-generation", { connection });

export interface TaskPayload {
  taskId: string;
  novelId: string;
  chapterId?: string;
  type: string;
  input?: any;
}

export function startWorker(io: Server) {
  const worker = new Worker<TaskPayload>(
    "novel-generation",
    async (job: Job<TaskPayload>) => {
      const { taskId, novelId, chapterId, type, input } = job.data;

      try {
        // Update task status to running
        await db
          .update(schema.tasks)
          .set({ status: "running", updatedAt: new Date() })
          .where(eq(schema.tasks.id, taskId));

        // Emit progress update
        io.to(`task:${taskId}`).emit("task:progress", {
          taskId,
          type,
          status: "running",
          progress: 0,
        });

        // Get novel and related data
        const novel = await db.query.novels.findFirst({
          where: eq(schema.novels.id, novelId),
        });

        if (!novel) {
          throw new Error("Novel not found");
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
          case "outline": {
            agent = new OutlineAgent(provider);
            const kbOutline = await retrieveRelevantKnowledge(
              novel.title || "大纲",
              novelId,
              5,
              0.3,
            );
            result = await agent.execute({
              novel,
              characters,
              knowledgeBase: kbOutline,
            });
            
            // 尝试解析结构化 JSON 大纲
            let structuredOutline: any = null;
            let parseError: string | null = null;
            
            try {
              // 使用现有的 cleanJson 函数清理可能包含 markdown 的 JSON 字符串
              const cleanedJson = cleanJson(result.content);
              structuredOutline = JSON.parse(cleanedJson);
              
              // 验证基本结构
              if (!structuredOutline.phases || !Array.isArray(structuredOutline.phases)) {
                throw new Error("大纲缺少必要的 phases 字段或格式不正确");
              }
              
              // 验证每个阶段都有事件
              for (const phase of structuredOutline.phases) {
                if (!phase.events || !Array.isArray(phase.events)) {
                  throw new Error(`阶段 ${phase.phaseName || phase.id} 缺少 events 字段`);
                }
                if (phase.events.length === 0) {
                  logger.warn(`阶段 ${phase.phaseName || phase.id} 的 events 数组为空`);
                }
              }
              
              logger.info(`大纲解析成功！包含 ${structuredOutline.phases.length} 个阶段，共 ${
                structuredOutline.phases.reduce((acc: number, p: any) => acc + (p.events?.length || 0), 0)
              } 个事件`);
              
            } catch (error: any) {
              parseError = error.message;
              logger.warn(`大纲 JSON 解析失败，将以纯文本格式保存。错误: ${error.message}`);
              // 不要在这里抛出异常，而是记录警告并继续保存原始内容
            }
            
            // 构建保存内容：优先使用格式化的 JSON，失败则使用原始内容
            let saveContent: string;
            let generationContext: any = {
              mode: "initial",
              parseError,
              generatedAt: new Date().toISOString(),
            };
            
            if (structuredOutline) {
              // 美化输出，同时确保是有效的 JSON
              saveContent = JSON.stringify(structuredOutline, null, 2);
              
              // 提取一些元数据到 generationContext 便于查询
              generationContext = {
                ...generationContext,
                version: structuredOutline.version,
                corePremise: structuredOutline.corePremise,
                centralTheme: structuredOutline.centralTheme,
                phaseCount: structuredOutline.phases?.length || 0,
                totalEvents: structuredOutline.phases?.reduce(
                  (acc: number, p: any) => acc + (p.events?.length || 0), 0
                ) || 0,
                estimatedTotalWords: structuredOutline.estimatedTotalWords,
                chapterCountEstimate: structuredOutline.chapterCountEstimate,
                isStructured: true,
              };
            } else {
              // 解析失败，使用原始内容
              saveContent = result.content;
              generationContext.isStructured = false;
            }
            
            // 获取当前最新版本号
            const latestVersion = await db.query.outlineVersions.findFirst({
              where: eq(schema.outlineVersions.novelId, novelId),
              orderBy: [desc(schema.outlineVersions.version)],
            });
            
            const newVersion = (latestVersion?.version || 0) + 1;
            
            // Save outline
            await db.insert(schema.outlineVersions).values({
              novelId,
              content: saveContent,
              version: newVersion,
              generationMode: "initial",
              generationContext,
            });
            
            // 如果是结构化大纲，且有 cliffhangerPoints，也可以在这里做一些额外处理
            // 比如：提取悬念点单独存储（可选优化）
            
            // Update novel current version
            await db
              .update(schema.novels)
              .set({ currentOutlineVersion: newVersion })
              .where(eq(schema.novels.id, novelId));
            
            // 构建返回结果，包含结构化信息
            result = {
              ...result,
              structuredOutline,
              generationContext,
              parseError,
              isStructured: !!structuredOutline,
            };
            break;
          }

          case "title": {
            agent = new TitleAgent(provider);
            result = await agent.execute({ novel, characters }, input.outline);
            break;
          }

          case "volume_planning": {
            const { outline, additionalRequirements } = input;
            agent = new VolumePlanningAgent(provider);
            const kbVolume = await retrieveRelevantKnowledge(
              "分卷规划",
              novelId,
              5,
              0.3,
            );
            const aiData = await agent.execute(
              { novel, characters, knowledgeBase: kbVolume },
              { outline, additionalRequirements },
            );

            const planning = JSON.parse(cleanJson(aiData.content));

            result = {
              volumes: planning.volumes,
              usage: {
                promptTokens: aiData.tokensUsed || 0,
                completionTokens: 0,
                totalTokens: aiData.tokensUsed || 0,
              },
            };
            break;
          }

          case "chapter_planning": {
            const {
              volumeId,
              additionalRequirements,
              targetCount = 30,
            } = input;

            // Use ChapterPlanningAgent for batch generation
            agent = new ChapterPlanningAgent(provider);

            const volume = await db.query.volumes.findFirst({
              where: eq(schema.volumes.id, volumeId),
              with: {
                novel: true,
                chapters: {
                  orderBy: (chapters, { asc }) => [asc(chapters.order)],
                },
              },
            });

            if (!volume) throw new Error("Volume not found");

            // Build existing chapters context string
            const existingChapters = volume.chapters || [];
            let existingChaptersContext = "";
            if (existingChapters.length > 0) {
              existingChaptersContext = existingChapters
                .map(
                  (ch) =>
                    `第${ch.order}章 ${ch.title}：${ch.outline || "暂无内容"}`,
                )
                .join("\n");
            }

            const kbChapter = await retrieveRelevantKnowledge(
              volume.title || "章节规划",
              novelId,
              5,
              0.3,
            );
            const aiResponse = await agent.execute(
              { novel, characters, knowledgeBase: kbChapter },
              {
                volumeTitle: volume.title,
                volumeSummary: volume.summary || "",
                novelOutline:
                  (volume.novel as any)?.outline || novel?.background || "",
                targetCount,
                existingChaptersContext,
                additionalRequirements,
              },
            );

            const parsed = JSON.parse(cleanJson(aiResponse.content));

            // Just in case the AI still includes prefixes like "第一章：" or "第1章 ", clean them up
            const cleanChapters = parsed.chapters.map((ch: any) => ({
              ...ch,
              title: ch.title
                .replace(
                  /^(第[零一二三四五六七八九十百千万\d]+[章节回]\s*[:：\s]?)/i,
                  "",
                )
                .trim(),
            }));

            result = {
              chapters: cleanChapters,
              usage: {
                promptTokens: aiResponse.tokensUsed || 0,
                completionTokens: 0,
                totalTokens: aiResponse.tokensUsed || 0,
              },
            };
            break;
          }

          case "chapter_outline": {
            // Ensure chapterId is available for this task type
            if (!chapterId) {
              throw new Error(
                "chapterId is required for chapter_outline task type",
              );
            }
            agent = new ChapterDetailAgent(provider); // Using ChapterDetailAgent for outline generation
            const chapter = await db.query.chapters.findFirst({
              where: eq(schema.chapters.id, chapterId),
            });
            const kbChapterOutline = await retrieveRelevantKnowledge(
              chapter?.title || "章节大纲",
              novelId,
              3,
              0.4,
            );
            result = await agent.execute(
              { novel, characters, knowledgeBase: kbChapterOutline },
              {
                order: chapter?.order,
                title: chapter?.title,
                summary: chapter?.outline,
              },
            );
            // Update chapter outline
            await db
              .update(schema.chapters)
              .set({ outline: result.content })
              .where(eq(schema.chapters.id, chapterId));
            break;
          }

          case "chapter_detail": {
            // Ensure chapterId is available for this task type
            if (!chapterId) {
              throw new Error(
                "chapterId is required for chapter_detail task type",
              );
            }
            agent = new ChapterDetailAgent(provider);
            const chapterForDetail = await db.query.chapters.findFirst({
              where: eq(schema.chapters.id, chapterId),
            });
            const kbChapterDetail = await retrieveRelevantKnowledge(
              chapterForDetail?.outline || chapterForDetail?.title || "",
              novelId,
              3,
              0.4,
            );
            result = await agent.execute(
              { novel, characters, knowledgeBase: kbChapterDetail },
              chapterForDetail?.outline,
            );
            // Update chapter detail outline
            await db
              .update(schema.chapters)
              .set({ detailOutline: result.content })
              .where(eq(schema.chapters.id, chapterId!));
            break;
          }

          case "content": {
            agent = new ContentAgent(provider);
            const chapterForContent = await db.query.chapters.findFirst({
              where: eq(schema.chapters.id, chapterId!),
            });

            // Extract input from job data
            const { input } = job.data;
            const targetOutline =
              input?.modifiedOutline ||
              chapterForContent?.detailOutline ||
              chapterForContent?.outline;
            const instructions = input?.additionalInstructions;

            // Stream content generation
            let generatedContent = "";
            const kbContent = await retrieveRelevantKnowledge(
              targetOutline || chapterForContent?.title || "",
              novelId,
              5,
              0.3,
            );
            result = await agent.executeStream(
              { novel, characters, knowledgeBase: kbContent },
              { outline: targetOutline, instructions },
              (chunk: string) => {
                generatedContent += chunk;
                // Emit real-time chunk
                io.to(`task:${taskId}`).emit("task:chunk", { taskId, chunk });
              },
            );

            // Run consistency check
            const consistencyAgent = new ConsistencyAgent(provider);
            const consistencyResult = await consistencyAgent.execute(
              { novel, characters, knowledgeBase: kbContent },
              result.content,
            );

            const consistencyCheck = JSON.parse(
              cleanJson(consistencyResult.content),
            );
            if (!consistencyCheck.passed) {
              throw new Error(
                `Consistency check failed: ${consistencyCheck.issues.join(", ")}`,
              );
            }

            // Update chapter content
            await db
              .update(schema.chapters)
              .set({
                content: result.content,
                wordCount: result.content.length,
                status: "completed",
                updatedAt: new Date(),
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
            status: "completed",
            progress: 100,
            result: result,
            metadata: {
              model: result.model,
              tokensUsed: result.tokensUsed,
            },
            updatedAt: new Date(),
          })
          .where(eq(schema.tasks.id, taskId));

        io.to(`task:${taskId}`).emit("task:completed", {
          taskId,
          type,
          novelId,
          result,
        });

        // Notify frontend to refresh
        io.emit("novel:updated", { novelId });

        logger.info(`Task ${taskId} completed successfully`);
        return result;
      } catch (error: any) {
        logger.error(`Task ${taskId} failed:`, error);

        // Update task as failed
        await db
          .update(schema.tasks)
          .set({
            status: "failed",
            error: error.message,
            updatedAt: new Date(),
          })
          .where(eq(schema.tasks.id, taskId));

        io.to(`task:${taskId}`).emit("task:failed", {
          taskId,
          error: error.message,
        });

        throw error;
      }
    },
    {
      connection,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          return Math.pow(2, attemptsMade) * 1000;
        },
      },
    },
  );

  // Configure default job options with retries
  worker.on("ready", () => {
    logger.info("Novel generation worker is ready");
  });

  worker.on("completed", (job) => {
    logger.info(`Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    logger.error(`Job ${job?.id} failed:`, err);
  });

  return worker;
}
