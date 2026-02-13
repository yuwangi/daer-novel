import './init-env'; // Must be the first import to ensure env vars are loaded before other modules
import dns from 'node:dns';

// Force IPv4 first to avoid "other side closed" errors with GitHub/OAuth providers on some networks
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { startWorker } from './queue/worker';
import { i18nMiddleware } from './config/i18n';

// Import routes
import novelRoutes from './routes/novel.routes';
import chapterRoutes from './routes/chapter.routes';
import knowledgeRoutes from './routes/knowledge.routes';
import aiConfigRoutes from './routes/aiConfig.routes';
import taskRoutes from './routes/task.routes';
import chatRoutes from './routes/chat.routes';

const app: Application = express();
const httpServer = createServer(app);
// CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:8001', 'tauri://localhost', 'http://tauri.localhost'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // allow requests with no origin (like mobile apps, curl requests, or SSR)
    if (!origin) return callback(null, true);
    
    // Check for allowed origins or development mode
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // If we're here, check if we want to be permissive for debugging
    if (process.env.CORS_ALLOW_ALL === 'true') {
        return callback(null, true);
    }

    console.warn(`Blocked by CORS: ${origin}`);
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
};

const io = new Server(httpServer, {
  cors: corsOptions,
});

const PORT = process.env.BACKEND_PORT || 8002;

// Middleware
// CORS must be first to handle preflight requests for ALL routes
app.use(cors(corsOptions));

// Trust proxy - Required for secure cookies behind Nginx
app.set('trust proxy', 1);

// Better-Auth handler - MUST be before body parsers but AFTER CORS
import { auth } from './config/auth.config';
import { toNodeHandler } from 'better-auth/node';

app.use('/api/auth', (req, _res, next) => {
  console.log(`[Auth Debug] Incoming request: ${req.method} ${req.originalUrl || req.url}`);
  console.log(`[Auth Debug] Headers: ${JSON.stringify({
    host: req.headers.host,
    'x-forwarded-proto': req.headers['x-forwarded-proto'],
    'x-forwarded-host': req.headers['x-forwarded-host'],
    origin: req.headers.origin
  })}`);
  
  // Also log body if it exists (for POST requests)
  if (req.method === 'POST') {
    // Note: body might not be parsed yet if this is before body-parser
    // but better-auth handles its own body if needed, or we might need to parse it
  }
  next();
});

app.all('/api/auth/*', (req, res) => { 
  toNodeHandler(auth)(req, res); 
});

// Body parsers - AFTER Better-Auth
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// i18n middleware - MUST be before routes
app.use(i18nMiddleware);

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve as any, swaggerUi.setup({
  openapi: '3.0.0',
  info: {
    title: 'Daer Novel API',
    version: '1.0.0',
    description: 'AI Novel Generation Platform API',
  },
}))

// Protected API Routes
app.use('/api/novels', authMiddleware, novelRoutes);
app.use('/api/novels', authMiddleware, taskRoutes); // Task routes for novel generation
app.use('/api/chapters', authMiddleware, chapterRoutes);
app.use('/api/knowledge', authMiddleware, knowledgeRoutes);
app.use('/api/ai-config', authMiddleware, aiConfigRoutes);
app.use('/api/tasks', authMiddleware, taskRoutes); // Task status routes
app.use('/api/chat', authMiddleware, chatRoutes);

// WebSocket for real-time task updates
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('subscribe:task', (taskId: string) => {
    socket.join(`task:${taskId}`);
    logger.info(`Client ${socket.id} subscribed to task ${taskId}`);
  });
  
  socket.on('unsubscribe:task', (taskId: string) => {
    socket.leave(`task:${taskId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start worker
startWorker(io);

// Start server
httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
  logger.info(`⚙️  Worker started and ready`);
});

export { app, io };
