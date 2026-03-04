import { Router } from 'express';
import { db, schema } from '../database';
import { eq, and } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import { createAIProvider } from '../services/ai/ai-config';
import { TitleAgent, ConceptExpandAgent, OutlineAgent, ChapterPlanningAgent, CharacterAgent, GlobalAnalysisAgent, KnowledgeExtractionAgent, StyleExtractionAgent } from '../services/ai/agents';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
//@ts-ignore
import EPub from 'epub2';
import jschardet from 'jschardet';
import iconv from 'iconv-lite';
import { cosService } from '../services/cos.service';
import { logger } from '../utils/logger';
//@ts-ignore
import epub from 'epub-gen-memory';

const router: Router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/imports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Helper for multi-point sampling of large files
const getFileChunks = (content: string, chunkCount: number = 5, chunkSize: number = 8000): string[] => {
  if (content.length <= chunkSize * chunkCount) {
    return [content];
  }
  
  const chunks: string[] = [];
  // 1. Start (Beginning of the story)
  chunks.push(content.slice(0, chunkSize));
  
  // 2. Middle sections (Key progression points)
  // We want points at 25%, 50%, and 75% roughly
  if (chunkCount > 2) {
    const step = 1 / (chunkCount - 1);
    for (let i = 1; i < chunkCount - 1; i++) {
      const percentage = step * i;
      const start = Math.floor(content.length * percentage);
      // Ensure we don't go out of bounds
      const actualStart = Math.min(start, content.length - chunkSize);
      chunks.push(content.slice(actualStart, actualStart + chunkSize));
    }
  }
  
  // 3. End (Climax/Conclusion)
  chunks.push(content.slice(-chunkSize));
  
  return chunks;
};

// Helper to fix garbled filename from multer (ISO-8859-1 to UTF-8)
const fixTitleEncoding = (title: string): string => {
  try {
    // If it already has Chinese, it's likely already correctly decoded
    if (/[\u4e00-\u9fa5]/.test(title)) return title;
    
    // Attempt decoding from Latin1 to UTF-8
    const decoded = Buffer.from(title, 'latin1').toString('utf8');
    
    // If the decoded version has Chinese and the original didn't, it's a valid fix
    if (/[\u4e00-\u9fa5]/.test(decoded)) return decoded;
    
    return title;
  } catch (e) {
    return title;
  }
};

// Helper for regex-based chapter detection with content extraction
const detectChaptersRegex = (content: string): { title: string; order: number; content: string }[] => {
  const chapterRegex = /(第[零一二三四五六七八九十百千万\d]+[章节回部卷]|[Cc]hapter\s*\d+|^\d+[\.\s、])\s*([^\n\r]{1,100})/gm;
  const chapters: { title: string; order: number; content: string }[] = [];
  let match;
  let order = 1;
  const matches: { index: number; title: string }[] = [];
  
  while ((match = chapterRegex.exec(content)) !== null) {
    matches.push({ index: match.index, title: match[0].trim() });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = (i + 1 < matches.length) ? matches[i+1].index : content.length;
    const chContent = content.slice(start, end).trim();
    // Remove the title from the beginning of the content if it's just the start
    const cleanContent = chContent.replace(matches[i].title, '').trim();
    
    chapters.push({ 
      title: matches[i].title, 
      order: order++, 
      content: cleanContent 
    });
  }
  
  return chapters;
};

const createNovelSchema = z.object({
  title: z.string().optional().nullable().transform(v => v ?? undefined),
  genre: z.array(z.string()).optional().nullable().transform(v => v ?? undefined),
  style: z.array(z.string()).optional().nullable().transform(v => v ?? undefined),
  writingStyleRules: z.string().optional().nullable().transform(v => v ?? undefined),
  targetAudience: z.array(z.string()).optional().nullable().transform(v => v ?? undefined),
  targetWords: z.number().optional().nullable().transform(v => v ?? undefined),
  minChapterWords: z.number().optional().nullable().transform(v => v ?? undefined),
  background: z.string().optional().nullable().transform(v => v ?? undefined),
  worldSettings: z.object({
    timeBackground: z.string().optional().nullable().transform(v => v ?? undefined),
    worldRules: z.array(z.string()).optional().nullable().transform(v => v ?? undefined),
    powerSystem: z.string().optional().nullable().transform(v => v ?? undefined),
    forbiddenRules: z.array(z.string()).optional().nullable().transform(v => v ?? undefined),
  }).optional().nullable().transform(v => v ?? undefined),
});

// Get all novels for user
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const novels = await db.query.novels.findMany({
      where: eq(schema.novels.userId, req.userId!),
      orderBy: (novels, { desc }) => [desc(novels.createdAt)],
    });

    res.json(novels);
  } catch (error) {
    next(error);
  }
});

// Get single novel
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const novel = await db.query.novels.findFirst({
      where: and(
        eq(schema.novels.id, req.params.id),
        eq(schema.novels.userId, req.userId!)
      ),
      with: {
        characters: true,
        knowledgeBases: {
          with: {
            documents: true
          }
        },
        volumes: {
          with: {
            chapters: true,
          },
        },
      },
    });

    if (!novel) {
      throw new AppError('Novel not found', 404);
    }

    res.json(novel);
  } catch (error) {
    next(error);
  }
});

// Create novel
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createNovelSchema.parse(req.body);

    const [novel] = await db
      .insert(schema.novels)
      .values({
        ...data,
        userId: req.userId!,
        status: 'draft',
      })
      .returning();

    res.status(201).json(novel);
  } catch (error) {
    next(error);
  }
});

// Update novel
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = createNovelSchema.partial().parse(req.body);

    const [novel] = await db
      .update(schema.novels)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.novels.id, req.params.id),
          eq(schema.novels.userId, req.userId!)
        )
      )
      .returning();

    if (!novel) {
      throw new AppError('Novel not found', 404);
    }

    res.json(novel);
  } catch (error) {
    next(error);
  }
});

// Extract writing style from sample text
router.post('/:id/extract-style', async (req: AuthRequest, res, next) => {
  try {
    const { sampleText } = req.body;
    
    if (!sampleText || typeof sampleText !== 'string' || sampleText.length < 50) {
      throw new AppError('样本文字太短，请至少提供50字以上', 400);
    }

    const novel = await db.query.novels.findFirst({
      where: and(
        eq(schema.novels.id, req.params.id),
        eq(schema.novels.userId, req.userId!)
      )
    });

    if (!novel) {
      throw new AppError('Novel not found', 404);
    }

    // Initialize StyleExtractionAgent
    const provider = await createAIProvider(req.userId!);
    const styleAgent = new StyleExtractionAgent(provider);
    
    // Call the agent to extract style rules
    const styleRulesResponse = await styleAgent.execute({ novel: novel as any }, sampleText);
    const rulesObj = JSON.parse(styleRulesResponse.content);
    const writingStyleRules = JSON.stringify(rulesObj, null, 2); // Format nicely

    // Update novel with new rules
    const [updatedNovel] = await db
      .update(schema.novels)
      .set({ writingStyleRules, updatedAt: new Date() })
      .where(eq(schema.novels.id, novel.id))
      .returning();

    res.json(updatedNovel);
  } catch (error) {
    next(error);
  }
});

// Update novel cover
router.patch('/:id/cover', upload.single('cover'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const localPath = req.file.path;
    const key = `covers/${req.file.filename}`;
    
    try {
      // Upload to COS
      const coverUrl = await cosService.uploadFile(localPath, key);

      // Delete local temporary file
      fs.unlink(localPath, (err) => {
        if (err) logger.error('Failed to delete local temp file:', err);
      });

      const [updatedNovel] = await db
        .update(schema.novels)
        .set({ coverUrl, updatedAt: new Date() })
        .where(
          and(
            eq(schema.novels.id, req.params.id),
            eq(schema.novels.userId, req.userId!)
          )
        )
        .returning();

      if (!updatedNovel) {
        throw new AppError('Novel not found', 404);
      }

      res.json(updatedNovel);
    } catch (error) {
      // Cleanup local file on error
      fs.unlink(localPath, () => {});
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Delete novel
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await db
      .delete(schema.novels)
      .where(
        and(
          eq(schema.novels.id, req.params.id),
          eq(schema.novels.userId, req.userId!)
        )
      );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Get characters for novel
router.get('/:id/characters', async (req: AuthRequest, res, next) => {
  try {
    const characters = await db.query.characters.findMany({
      where: eq(schema.characters.novelId, req.params.id),
    });

    res.json(characters);
  } catch (error) {
    next(error);
  }
});

// Create character
router.post('/:id/characters', async (req: AuthRequest, res, next) => {
  try {
    const [character] = await db
      .insert(schema.characters)
      .values({
        novelId: req.params.id,
        ...req.body,
      })
      .returning();

    res.status(201).json(character);
  } catch (error) {
    next(error);
  }
});

// Update character
router.patch('/:novelId/characters/:characterId', async (req: AuthRequest, res, next) => {
  try {
    const [character] = await db
      .update(schema.characters)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(schema.characters.id, req.params.characterId))
      .returning();

    res.json(character);
  } catch (error) {
    next(error);
  }
});

// Delete character
router.delete('/:novelId/characters/:characterId', async (req: AuthRequest, res, next) => {
  try {
    await db
      .delete(schema.characters)
      .where(eq(schema.characters.id, req.params.characterId));

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// --- Plot Thread Routes ---

// Get plot threads for novel
router.get('/:id/threads', async (req: AuthRequest, res, next) => {
  try {
    const threads = await db.query.plotThreads.findMany({
      where: eq(schema.plotThreads.novelId, req.params.id),
      orderBy: (threads, { desc }) => [desc(threads.createdAt)],
    });
    res.json(threads);
  } catch (error) {
    next(error);
  }
});

// Create plot thread
router.post('/:id/threads', async (req: AuthRequest, res, next) => {
  try {
    const [thread] = await db
      .insert(schema.plotThreads)
      .values({
        novelId: req.params.id,
        ...req.body,
      })
      .returning();
    res.status(201).json(thread);
  } catch (error) {
    next(error);
  }
});

// Update plot thread
router.patch('/:novelId/threads/:threadId', async (req: AuthRequest, res, next) => {
  try {
    const [thread] = await db
      .update(schema.plotThreads)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(schema.plotThreads.id, req.params.threadId))
      .returning();
    res.json(thread);
  } catch (error) {
    next(error);
  }
});

// Delete plot thread
router.delete('/:novelId/threads/:threadId', async (req: AuthRequest, res, next) => {
  try {
    await db
      .delete(schema.plotThreads)
      .where(eq(schema.plotThreads.id, req.params.threadId));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// --- Timeline Routes ---

// Get timeline events for novel
router.get('/:id/timeline', async (req: AuthRequest, res, next) => {
  try {
    const events = await db.query.timelineEvents.findMany({
      where: eq(schema.timelineEvents.novelId, req.params.id),
      orderBy: (events, { asc }) => [asc(events.order), asc(events.createdAt)],
    });
    res.json(events);
  } catch (error) {
    next(error);
  }
});

// Create timeline event
router.post('/:id/timeline', async (req: AuthRequest, res, next) => {
  try {
    const [event] = await db
      .insert(schema.timelineEvents)
      .values({
        novelId: req.params.id,
        ...req.body,
      })
      .returning();
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

// Update timeline event
router.patch('/:novelId/timeline/:eventId', async (req: AuthRequest, res, next) => {
  try {
    const [event] = await db
      .update(schema.timelineEvents)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(schema.timelineEvents.id, req.params.eventId))
      .returning();
    res.json(event);
  } catch (error) {
    next(error);
  }
});

// Delete timeline event
router.delete('/:novelId/timeline/:eventId', async (req: AuthRequest, res, next) => {
  try {
    await db
      .delete(schema.timelineEvents)
      .where(eq(schema.timelineEvents.id, req.params.eventId));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// --- Outline Routes ---

// Get outline versions
router.get('/:id/outline/versions', async (req: AuthRequest, res, next) => {
  try {
    const { outlineService } = await import('../services/outline.service');
    const versions = await outlineService.getVersions(req.params.id);
    res.json(versions);
  } catch (error) {
    next(error);
  }
});

// Stream generate outline
router.get('/:id/generate/outline/stream', async (req: AuthRequest, res, next) => {
  let clientClosed = false;

  req.on('close', () => {
    clientClosed = true;
  });

  try {
    const { outlineService } = await import('../services/outline.service');
    const { mode, existingOutline } = req.query as any;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await outlineService.generateStream(
      req.params.id,
      req.userId!,
      mode,
      existingOutline,
      (chunk) => {
        if (clientClosed) return; // client already disconnected, skip
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }
    );

    if (!clientClosed) {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    // Case 1: The CLIENT closed the connection (user navigated away / closed tab).
    // The response stream is already gone — do nothing.
    if (clientClosed) return;

    // Case 2: The AI provider's stream broke (ERR_STREAM_PREMATURE_CLOSE from upstream).
    // The client is still connected, so we MUST send an error event and end the response.
    // Without res.end() the SSE connection stays open and isStreaming never resets on the frontend.
    const isUpstreamPrematureClose =
      error?.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
      error?.message?.includes('Premature close');

    if (isUpstreamPrematureClose) {
      if (!clientClosed) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI连接中断，请重试' })}\n\n`);
        res.end();
      }
      return;
    }

    // Case 3: Any other unexpected error.
    console.error('Stream generation error:', error);
    if (!res.headersSent) {
      next(error);
    } else if (!clientClosed) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Generation failed' })}\n\n`);
      res.end();
    }
  }
});


// Save outline version
router.post('/:id/outline/versions', async (req: AuthRequest, res, next) => {
  try {
    const { outlineService } = await import('../services/outline.service');
    const { content, context, mode } = req.body;
    
    const version = await outlineService.createVersion(
      req.params.id,
      content,
      context,
      mode
    );
    res.status(201).json(version);
  } catch (error) {
    next(error);
  }
});

// Lock/Unlock version
router.patch('/:novelId/outline/versions/:versionId/lock', async (req: AuthRequest, res, next) => {
  try {
    const { outlineService } = await import('../services/outline.service');
    const { isLocked } = req.body;
    const [version] = await outlineService.toggleLock(req.params.versionId, isLocked);
    res.json(version);
  } catch (error) {
    next(error);
  }
});

// Rollback version
router.post('/:id/outline/versions/:versionId/rollback', async (req: AuthRequest, res, next) => {
  try {
    const { outlineService } = await import('../services/outline.service');
    const version = await outlineService.rollback(req.params.id, req.params.versionId);
    res.status(201).json(version);
  } catch (error) {
    next(error);
  }
});

// --- AI Suggestion Routes ---

// Suggest title
router.post('/suggestions/titles', async (req: AuthRequest, res, next) => {
  try {
    const { genre, style, background } = req.body;
    console.log(`[AI] Title suggestion requested for genre: ${genre}, style: ${style}`);
    
    const provider = await createAIProvider(req.userId!);
    const config = (provider as any).config;
    console.log(`[AI] Using provider: ${config?.provider}, model: ${config?.model}, baseUrl: ${config?.baseUrl || 'default'}`);
    const agent = new TitleAgent(provider);
    
    const startTime = Date.now();
    console.log(`[AI] Sending request at ${new Date().toISOString()}...`);
    const response = await agent.execute(
      { novel: { genre, style, background } },
      background || '未提供具体大纲，请根据类型和风格自由发挥'
    );
    const duration = Date.now() - startTime;
    console.log(`[AI] Response received in ${duration}ms`);

    const titles = response.content.split('\n').map(t => t.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    res.json({ titles, title: titles[0] || response.content.trim() });
  } catch (error: any) {
    console.error('[AI] Title suggestion error:', error.message || error);
    next(error);
  }
});

// Expand background
router.post('/suggestions/expand-background', async (req: AuthRequest, res, next) => {
  try {
    const { genre, style, background } = req.body;
    const provider = await createAIProvider(req.userId!);
    const agent = new ConceptExpandAgent(provider);

    const response = await agent.execute(
      { novel: { genre, style } },
      background
    );

    res.json({ background: response.content.trim() });
  } catch (error) {
    next(error);
  }
});

// --- Export/Import Routes ---

// Export novel
router.get('/:id/export', async (req: AuthRequest, res, next) => {
  try {
    const format = req.query.format as string || 'json';
    const novel = await db.query.novels.findFirst({
      where: and(
        eq(schema.novels.id, req.params.id),
        eq(schema.novels.userId, req.userId!)
      ),
      with: {
        characters: true,
        knowledgeBases: {
          with: {
            documents: true
          }
        },
        volumes: {
          with: {
            chapters: {
              orderBy: (chapters, { asc }) => [asc(chapters.order)]
            },
          },
          orderBy: (volumes, { asc }) => [asc(volumes.order)]
        },
        outlineVersions: true,
      },
    });

    if (!novel) {
      throw new AppError('Novel not found', 404);
    }

    if (format === 'txt') {
      let txtContent = `${novel.title || '未命名小说'}\n\n`;
      txtContent += `类型: ${novel.genre?.join(', ') || '未知'}\n`;
      txtContent += `创作背景:\n${novel.background || '暂无'}\n\n`;
      txtContent += `--- 正文 ---\n\n`;

      for (const volume of novel.volumes) {
        if (novel.volumes.length > 1 || volume.title !== '正文') {
          txtContent += `卷: ${volume.title}\n\n`;
        }
        for (const chapter of volume.chapters) {
          txtContent += `第 ${chapter.order} 章: ${chapter.title}\n\n`;
          txtContent += `${chapter.content || '（暂无内容）'}\n\n`;
          txtContent += `------------------\n\n`;
        }
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(novel.title || 'novel')}.txt"`);
      res.send(txtContent);
      return;
    }

    if (format === 'epub') {
      const option = {
        title: novel.title || '未命名小说',
        author: req.user?.name || '大耳小说家',
        publisher: 'Daer Novel AI',
      };
      
      const content = novel.volumes.flatMap(v => v.chapters.map(ch => ({
        title: novel.volumes.length > 1 ? `${v.title} - ${ch.title}` : ch.title,
        content: `<p>${(ch.content || '（暂无内容）').replace(/\n/g, '</p><p>')}</p>`
      })));

      // epub-gen-memory returns a Promise<Buffer>
      const buffer = await epub(option, content);
      res.setHeader('Content-Type', 'application/epub+zip');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(novel.title || 'novel')}.epub"`);
      res.send(buffer);
      return;
    }

    // Default JSON export
    const exportData = {
      version: '1.0',
      type: 'novel-project',
      novel: {
        title: novel.title,
        genre: novel.genre,
        style: novel.style,
        targetAudience: novel.targetAudience,
        targetWords: novel.targetWords,
        minChapterWords: novel.minChapterWords,
        background: novel.background,
        worldSettings: novel.worldSettings,
        status: novel.status,
      },
      characters: novel.characters.map(c => ({
        name: c.name,
        role: c.role,
        personality: c.personality,
        abilities: c.abilities,
        currentState: c.currentState,
      })),
      knowledgeBases: novel.knowledgeBases.map(kb => ({
        name: kb.name,
        type: kb.type,
        description: kb.description,
        documents: kb.documents.map(doc => ({
          title: doc.title,
          content: doc.content,
          metadata: doc.metadata,
        })),
      })),
      outlineVersions: novel.outlineVersions.map(ov => ({
        version: ov.version,
        content: ov.content,
        generationMode: ov.generationMode,
        generationContext: ov.generationContext,
      })),
      volumes: novel.volumes.map(v => ({
        title: v.title,
        order: v.order,
        chapters: v.chapters.map(ch => ({
          title: ch.title,
          order: ch.order,
          outline: ch.outline,
          detailOutline: ch.detailOutline,
          content: ch.content,
          status: ch.status,
        })),
      })),
    };

    res.json(exportData);
  } catch (error) {
    next(error);
  }
});

// Import/Initialize novel
router.post('/import', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    let importData: any = {};
    
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext === '.json') {
        const buffer = fs.readFileSync(req.file.path);
        const detection = jschardet.detect(buffer);
        const encoding = detection.encoding || 'utf-8';
        const content = iconv.decode(buffer, encoding);
        importData = JSON.parse(content);
      } else if (ext === '.txt') {
        const buffer = fs.readFileSync(req.file.path);
        const detection = jschardet.detect(buffer);
        const encoding = detection.encoding || 'utf-8';
        const content = iconv.decode(buffer, encoding);
        
        const chunks = getFileChunks(content, 5, 3000); // 5 chunks, 3k each
        const chapters = detectChaptersRegex(content);
        const title = fixTitleEncoding(path.basename(req.file.originalname, '.txt'));

        importData = {
          novel: {
            title,
            background: content.slice(0, 5000), // First part for immediate title
          },
          sourceChunks: chunks,
          detectedChapters: chapters,
          initialize: true
        };
      } else if (ext === '.epub') {
        const epub = new EPub(req.file.path);
        await new Promise((resolve, reject) => {
          epub.on('end', resolve);
          epub.on('error', reject);
          epub.parse();
        });

        const title = fixTitleEncoding((epub as any).metadata.title || path.basename(req.file.originalname, '.epub'));
        let fullContent = '';
        const flow = (epub as any).flow;
        
        for (const f of flow) {
          const text = await new Promise<string>((resolve, reject) => {
            (epub as any).getChapter(f.id, (err: any, text: string) => {
              if (err) reject(err);
              else resolve(text);
            });
          });
          fullContent += text.replace(/<[^>]*>?/gm, '') + '\n';
        }

        const chunks = getFileChunks(fullContent, 5, 3000);
        const detectedChapters = detectChaptersRegex(fullContent);

        importData = {
          novel: {
            title,
            background: fullContent.slice(0, 5000),
          },
          sourceChunks: chunks,
          detectedChapters,
          initialize: true
        };
      }
      
      // Clean up uploaded file
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    } else {
      importData = req.body;
    }

    const { novel: novelData, characters, knowledgeBases, outlineVersions, volumes, initialize, sourceChunks, detectedChapters } = importData;

    // 1. Create Novel
    const [novel] = await db
      .insert(schema.novels)
      .values({
        ...novelData,
        userId: req.userId!,
        status: novelData?.status || 'draft',
      })
      .returning();

    // 2. Handle Initialization if requested
    if (initialize) {
      const provider = await createAIProvider(req.userId!);

      let currentBackground = novelData?.background || '';
      let currentSummary = '';

      // Perform Global Analysis if we have source chunks
      if (sourceChunks && sourceChunks.length > 0) {
        const globalAgent = new GlobalAnalysisAgent(provider);
        const analysisResponse = await globalAgent.execute({ novel: { ...novelData }, sourceChunks });
        try {
          const analysis = JSON.parse(analysisResponse.content.replace(/```json/g, '').replace(/```/g, '').trim());
          currentBackground = analysis.background || currentBackground;
          currentSummary = analysis.summary || '';
          
          // Update novel with richer background
          await db.update(schema.novels).set({
            background: currentBackground,
            style: analysis.theme ? [analysis.theme] : novelData.style,
          }).where(eq(schema.novels.id, novel.id));
        } catch (e) {
          console.error('Failed to parse global analysis:', e);
        }
      }

      // Generate Outline if missing (using consolidated summary if available)
      let currentOutline = currentSummary || currentBackground || '';
      if (!outlineVersions || outlineVersions.length === 0) {
        const agent = new OutlineAgent(provider);
        const response = await agent.execute(
          { novel: { ...novel, background: currentBackground } }, 
          { mode: 'initial', existingOutline: currentSummary }
        );
        currentOutline = response.content;
        await db.insert(schema.outlineVersions).values({
          novelId: novel.id,
          version: 1,
          content: currentOutline,
          generationMode: 'initial',
        });
      } else {
        // ... (rest of outline restoration)
        // Restore outline versions
        for (const ov of outlineVersions) {
          await db.insert(schema.outlineVersions).values({
            novelId: novel.id,
            ...ov,
          });
        }
        currentOutline = outlineVersions[outlineVersions.length - 1].content;
      }

      // Generate Characters if missing
      if (!characters || characters.length === 0) {
        const agent = new CharacterAgent(provider);
        const response = await agent.execute({ novel: { ...novel, background: currentBackground }, sourceChunks });
        try {
          const generatedCharacters = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim());
          if (Array.isArray(generatedCharacters)) {
            // Sort by role/importance if needed (LLM should have done this)
            for (const char of generatedCharacters) {
              await db.insert(schema.characters).values({
                novelId: novel.id,
                name: char.name,
                role: char.role,
                personality: char.personality,
                currentState: `${char.description}\n能力：${char.capabilities}`,
                // Map capabilities to a simple object array for the abilities field if possible
                abilities: char.capabilities ? [{ name: '核心能力', level: char.importance || 5 }] : [],
              });
            }
          }
        } catch (e) {
          console.error('Failed to parse generated characters:', e);
        }
      } else {
        // ... (rest of character restoration)
        // Restore characters
        for (const char of characters) {
          await db.insert(schema.characters).values({
            novelId: novel.id,
            ...char,
          });
        }
      }

      // 3. Handle Chapter Mapping (Phase 2)
      if (!volumes || volumes.length === 0) {
        if (detectedChapters && detectedChapters.length > 0) {
          console.log(`[Import] Mapping ${detectedChapters.length} detected chapters`);
          
          // Split into volumes of 100 if > 100
          if (detectedChapters.length > 100) {
            const volumeSize = 100;
            const volumeCount = Math.ceil(detectedChapters.length / volumeSize);
            
            for (let vIdx = 0; vIdx < volumeCount; vIdx++) {
              const [newVolume] = await db.insert(schema.volumes).values({
                novelId: novel.id,
                title: `第${vIdx + 1}部分`,
                order: vIdx + 1,
              }).returning();
              
              const start = vIdx * volumeSize;
              const end = Math.min(start + volumeSize, detectedChapters.length);
              const vChapters = detectedChapters.slice(start, end);
              
              for (const ch of vChapters) {
                await db.insert(schema.chapters).values({
                  novelId: novel.id,
                  volumeId: newVolume.id,
                  title: ch.title,
                  order: ch.order,
                  content: ch.content,
                  wordCount: ch.content?.length || 0,
                  status: 'completed', // Since we imported content
                });
              }
            }
          } else {
            // Single volume
            const [newVolume] = await db.insert(schema.volumes).values({
              novelId: novel.id,
              title: '正文',
              order: 1,
            }).returning();
            
            for (const ch of detectedChapters) {
              await db.insert(schema.chapters).values({
                novelId: novel.id,
                volumeId: newVolume.id,
                title: ch.title,
                order: ch.order,
                content: ch.content,
                wordCount: ch.content?.length || 0,
                status: 'completed',
              });
            }
          }
        } else {
          // Fallback to AI planning
          const agent = new ChapterPlanningAgent(provider);
          const response = await agent.execute({ novel: { ...novel, background: currentBackground } }, currentOutline);
          try {
            const cleanJson = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const planning = JSON.parse(cleanJson);
            if (planning.volumes) {
              for (const v of planning.volumes) {
                const [newVolume] = await db.insert(schema.volumes).values({
                  novelId: novel.id,
                  title: v.title,
                  order: planning.volumes.indexOf(v) + 1,
                }).returning();

                for (const ch of v.chapters) {
                  await db.insert(schema.chapters).values({
                    novelId: novel.id,
                    volumeId: newVolume.id,
                    title: ch.title,
                    order: v.chapters.indexOf(ch) + 1,
                    outline: ch.summary,
                    status: 'pending',
                  });
                }
              }
            }
          } catch (e) {
            console.error('Failed to parse chapter planning:', e);
          }
        }
      } else {
        // ... (rest of volume restoration)
        // Restore volumes and chapters
        for (const v of volumes) {
          const [newVolume] = await db.insert(schema.volumes).values({
            novelId: novel.id,
            title: v.title,
            order: v.order,
          }).returning();

          if (v.chapters) {
            for (const ch of v.chapters) {
              await db.insert(schema.chapters).values({
                novelId: novel.id,
                volumeId: newVolume.id,
                ...ch,
              });
            }
          }
        }
      }

      // 4. Initialize Knowledge Base (Phase 3)
      if (!knowledgeBases || knowledgeBases.length === 0) {
        const kbAgent = new KnowledgeExtractionAgent(provider);
        const kbResponse = await kbAgent.execute({ novel: { ...novel, background: currentBackground }, sourceChunks });
        
        try {
          const extractedDocs = JSON.parse(kbResponse.content.replace(/```json/g, '').replace(/```/g, '').trim());
          if (Array.isArray(extractedDocs)) {
            // Create a general KB if not exists
            const [kb] = await db.insert(schema.knowledgeBases).values({
              novelId: novel.id,
              name: '世界设定',
              type: 'world',
              description: '根据采样内容自动提取的设定库',
            }).returning();
            
            for (const doc of extractedDocs) {
              await db.insert(schema.knowledgeDocuments).values({
                knowledgeBaseId: kb.id,
                title: doc.title || doc.category,
                content: doc.content,
                metadata: { category: doc.category }
              });
            }
          }
        } catch (e) {
          console.error('Failed to parse knowledge extraction:', e);
          // Fallback to simple KB
          const [kb] = await db.insert(schema.knowledgeBases).values({
            novelId: novel.id,
            name: '世界设定',
            type: 'world',
            description: '自动生成的初版世界观设定',
          }).returning();

          if (novel.worldSettings) {
            await db.insert(schema.knowledgeDocuments).values({
              knowledgeBaseId: kb.id,
              title: '核心设定',
              content: JSON.stringify(novel.worldSettings, null, 2),
            });
          }
        }
      } else {
        // ... (rest of KB restoration)
        // Restore knowledge bases
        for (const kb of knowledgeBases) {
          const [newKb] = await db.insert(schema.knowledgeBases).values({
            novelId: novel.id,
            name: kb.name,
            type: kb.type,
            description: kb.description,
          }).returning();

          if (kb.documents) {
            for (const doc of kb.documents) {
              await db.insert(schema.knowledgeDocuments).values({
                knowledgeBaseId: newKb.id,
                ...doc,
              });
            }
          }
        }
      }
    } else {
      // Full restore (no AI initialization)
      if (characters) {
        for (const char of characters) {
          await db.insert(schema.characters).values({ novelId: novel.id, ...char });
        }
      }
      if (knowledgeBases) {
        for (const kb of knowledgeBases) {
          const [newKb] = await db.insert(schema.knowledgeBases).values({
            novelId: novel.id,
            name: kb.name,
            type: kb.type,
            description: kb.description,
          }).returning();
          if (kb.documents) {
            for (const doc of kb.documents) {
              await db.insert(schema.knowledgeDocuments).values({ knowledgeBaseId: newKb.id, ...doc });
            }
          }
        }
      }
      if (outlineVersions) {
        for (const ov of outlineVersions) {
          await db.insert(schema.outlineVersions).values({ novelId: novel.id, ...ov });
        }
      }
      if (volumes) {
        for (const v of volumes) {
          const [newVolume] = await db.insert(schema.volumes).values({ novelId: novel.id, title: v.title, order: v.order }).returning();
          if (v.chapters) {
            for (const ch of v.chapters) {
              await db.insert(schema.chapters).values({ novelId: novel.id, volumeId: newVolume.id, ...ch });
            }
          }
        }
      }
    }

    res.status(201).json(novel);

    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) logger.error('Failed to delete novel import temp file:', err);
      });
    }
  } catch (error) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    next(error);
  }
});

export default router;
