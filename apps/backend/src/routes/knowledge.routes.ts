import { Router } from 'express';
import { db, schema } from '../database';
import { eq, and, inArray } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth';
import { generateEmbeddings, searchSimilarDocuments } from '../services/embedding';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router: Router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/knowledge');
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.txt', '.md', '.pdf', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  },
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userNovels = await db.query.novels.findMany({
      where: eq(schema.novels.userId, req.userId!),
      columns: { id: true },
    });
    const novelIds = userNovels.map(n => n.id);

    if (novelIds.length === 0) {
      return res.json([]);
    }

    const knowledgeBases = await db.query.knowledgeBases.findMany({
      where: inArray(schema.knowledgeBases.novelId, novelIds),
      with: {
        documents: true,
      },
    });

    return res.json(knowledgeBases);
  } catch (error) {
    return next(error);
  }
});

// Get all knowledge bases for a novel
router.get('/:novelId', async (req: AuthRequest, res, next) => {
  try {
    const knowledgeBases = await db.query.knowledgeBases.findMany({
      where: eq(schema.knowledgeBases.novelId, req.params.novelId),
      with: {
        documents: true,
      },
    });

    res.json(knowledgeBases);
  } catch (error) {
    next(error);
  }
});

// Create knowledge base
router.post('/:novelId', async (req: AuthRequest, res, next) => {
  try {
    const { name, description, type, sourceKbId } = req.body;

    const [knowledgeBase] = await db
      .insert(schema.knowledgeBases)
      .values({
        novelId: req.params.novelId,
        name,
        description,
        type: type || 'general',
      })
      .returning();

    // If sourceKbId is provided, copy documents
    if (sourceKbId) {
      const sourceDocs = await db.query.knowledgeDocuments.findMany({
        where: eq(schema.knowledgeDocuments.knowledgeBaseId, sourceKbId),
      });

      if (sourceDocs.length > 0) {
        await db.insert(schema.knowledgeDocuments).values(
          sourceDocs.map(doc => ({
            knowledgeBaseId: knowledgeBase.id,
            title: doc.title,
            content: doc.content,
            filePath: doc.filePath,
            fileType: doc.fileType,
            embedding: doc.embedding,
            metadata: doc.metadata,
          }))
        );
      }
    }

    res.json(knowledgeBase);
  } catch (error) {
    next(error);
  }
});

// Update knowledge base
router.patch('/:novelId/:id', async (req: AuthRequest, res, next) => {
  try {
    const { name, description } = req.body;

    const [updated] = await db
      .update(schema.knowledgeBases)
      .set({ name, description })
      .where(
        and(
          eq(schema.knowledgeBases.id, req.params.id),
          eq(schema.knowledgeBases.novelId, req.params.novelId)
        )
      )
      .returning();

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete knowledge base
router.delete('/:novelId/:id', async (req: AuthRequest, res, next) => {
  try {
    // Delete all documents first
    await db
      .delete(schema.knowledgeDocuments)
      .where(eq(schema.knowledgeDocuments.knowledgeBaseId, req.params.id));

    // Delete knowledge base
    await db
      .delete(schema.knowledgeBases)
      .where(
        and(
          eq(schema.knowledgeBases.id, req.params.id),
          eq(schema.knowledgeBases.novelId, req.params.novelId)
        )
      );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Upload document to knowledge base
(router as any).post(
  '/:novelId/:knowledgeBaseId/documents',
  upload.single('file'),
  async (req: any, res: any, next: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '未上传文件' });
      }

      const { title, content } = req.body;

      // Read file content if not provided
      let documentContent = content;
      if (!documentContent && req.file) {
        documentContent = fs.readFileSync(req.file.path, 'utf-8');
      }

      // Generate embeddings
      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbeddings(documentContent);
      } catch (err) {
        console.error('Failed to generate embeddings during upload:', err);
      }

      const [document] = await db
        .insert(schema.knowledgeDocuments)
        .values({
          knowledgeBaseId: req.params.knowledgeBaseId,
          title: title || req.file.originalname,
          content: documentContent,
          filePath: req.file.path,
          fileType: path.extname(req.file.originalname),
          embedding: embedding ? JSON.stringify(embedding) : null,
        } as any)
        .returning();

      res.json(document);
    } catch (error) {
      next(error);
    }
  }
);

// Get documents in knowledge base
router.get('/:novelId/:knowledgeBaseId/documents', async (req: AuthRequest, res, next) => {
  try {
    const documents = await db.query.knowledgeDocuments.findMany({
      where: eq(schema.knowledgeDocuments.knowledgeBaseId, req.params.knowledgeBaseId),
    });

    res.json(documents);
  } catch (error) {
    next(error);
  }
});

// Delete document
router.delete(
  '/:novelId/:knowledgeBaseId/documents/:documentId',
  async (req: AuthRequest, res, next) => {
    try {
      // Get document to delete file
      const document = await db.query.knowledgeDocuments.findFirst({
        where: eq(schema.knowledgeDocuments.id, req.params.documentId),
      });

      if (document?.filePath && fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }

      await db
        .delete(schema.knowledgeDocuments)
        .where(eq(schema.knowledgeDocuments.id, req.params.documentId));

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// Search in knowledge base (semantic search)
router.post('/:novelId/:knowledgeBaseId/search', async (req: AuthRequest, res, next) => {
  try {
    const { query, limit = 5 } = req.body;

    // Fetch all documents with embeddings for this KB
    const documents = await db.query.knowledgeDocuments.findMany({
      where: eq(schema.knowledgeDocuments.knowledgeBaseId, req.params.knowledgeBaseId),
    });

    const docsWithEmbeddings = documents.map(doc => ({
      ...doc,
      embedding: doc.embedding ? JSON.parse(doc.embedding as string) : undefined
    }));

    if (docsWithEmbeddings.some(d => d.embedding)) {
      const results = await searchSimilarDocuments(query, docsWithEmbeddings, limit);
      return res.json(results);
    }

    // Fallback to simple text search if no embeddings
    const fallbackResults = documents
      .filter((doc) => doc.content?.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit);

    return res.json(fallbackResults);
  } catch (error) {
    return next(error);
  }
});

export default router;
