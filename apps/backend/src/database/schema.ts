
import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum, boolean } from 'drizzle-orm/pg-core';

// Enums
export const novelStatusEnum = pgEnum('novel_status', ['draft', 'generating', 'completed', 'archived']);
export const chapterStatusEnum = pgEnum('chapter_status', ['pending', 'generating', 'completed', 'failed']);
export const taskStatusEnum = pgEnum('task_status', ['queued', 'running', 'completed', 'failed', 'cancelled']);
export const taskTypeEnum = pgEnum('task_type', ['outline', 'title', 'chapter_planning', 'chapter_outline', 'chapter_detail', 'content', 'consistency_check']);
export const plotThreadStatusEnum = pgEnum('plot_thread_status', ['open', 'resolved', 'dropped']);

// Users table (Better-Auth compatible)
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  password: text('password'), // Nullable for OAuth users
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Better-Auth Sessions table
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expiresAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Better-Auth Accounts table (for OAuth providers)
export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  expiresAt: timestamp('expiresAt'),
  idToken: text('idToken'), // Added commonly used idToken
  password: text('password'), // Sometimes used
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Better-Auth Verification Tokens table
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(), // Better-Auth uses 'value', not 'token'
  expiresAt: timestamp('expiresAt').notNull(), // Better-Auth uses 'expiresAt'
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Novels table
export const novels = pgTable('novels', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title'),
  coverUrl: text('cover_url'),
  genre: jsonb('genre').$type<string[]>(), // ['玄幻', '都市']
  style: jsonb('style').$type<string[]>(), // ['爽文', '热血']
  writingStyleRules: text('writing_style_rules'), // AI-extracted style rules for mimicry
  targetAudience: jsonb('target_audience').$type<string[]>(),
  targetWords: integer('target_words').default(100000),
  minChapterWords: integer('min_chapter_words').default(3000),
  background: text('background'),
  worldSettings: jsonb('world_settings').$type<{
    timeBackground?: string;
    worldRules?: string[];
    powerSystem?: string;
    forbiddenRules?: string[];
  }>(),
  currentOutlineVersion: integer('current_outline_version').default(1),
  status: novelStatusEnum('status').default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Characters table
export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  role: text('role'), // '主角', '配角', '反派'
  personality: jsonb('personality').$type<string[]>(),
  abilities: jsonb('abilities').$type<{ name: string; level: number }[]>(),
  relationships: jsonb('relationships').$type<{ characterId: string; relation: string }[]>(),
  currentState: text('current_state'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Knowledge bases table
export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type'), // 'world', 'character', 'reference'
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Knowledge documents table
// Knowledge Documents table
export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  knowledgeBaseId: uuid('knowledge_base_id').notNull().references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  filePath: text('file_path'),
  fileType: text('file_type'),
  embedding: text('embedding'), // Vector embedding as JSON string
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Plot Sandboxes table - NEW
export const plotSandboxes = pgTable('plot_sandboxes', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  premise: text('premise').notNull(), // The "what-if" scenario
  content: text('content'), // AI generated plot developments or user notes
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Plot Threads table - NEW
export const plotThreads = pgTable('plot_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  status: plotThreadStatusEnum('status').default('open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Timeline Events table - NEW
export const timelineEvents = pgTable('timeline_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  timeLabel: text('time_label'),
  order: integer('order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Outline Versions table - NEW
export const outlineVersions = pgTable('outline_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  content: text('content').notNull(),
  generationMode: text('generation_mode'), // 'initial', 'expand', 'adjust_pace_fast', 'adjust_pace_slow', 'strengthen_conflict', 'preserve_characters'
  generationContext: jsonb('generation_context').$type<{
    title?: string;
    genre?: string[];
    style?: string[];
    targetWords?: number;
    worldSettings?: boolean;
    knowledgeBases?: string[];
    mode?: string;
  }>(),
  isLocked: integer('is_locked').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Volumes table
export const volumes = pgTable('volumes', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  order: integer('order').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Chapters table
export const chapters = pgTable('chapters', {
  id: uuid('id').primaryKey().defaultRandom(),
  volumeId: uuid('volume_id').notNull().references(() => volumes.id, { onDelete: 'cascade' }),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  order: integer('order').notNull(),
  outline: text('outline'), // Chapter-level outline
  detailOutline: text('detail_outline'), // Detailed scene breakdown
  content: text('content'), // Generated prose
  wordCount: integer('word_count').default(0),
  status: chapterStatusEnum('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Chapter Snapshots table (Version History)
export const chapterSnapshots = pgTable('chapter_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  title: text('title').notNull(),
  wordCount: integer('word_count').default(0),
  label: text('label'), // Optional user label, e.g. 'AI改写前', '手动保存'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'cascade' }),
  type: taskTypeEnum('type').notNull(),
  status: taskStatusEnum('status').default('queued'),
  progress: integer('progress').default(0), // 0-100
  result: jsonb('result').$type<any>(),
  error: text('error'),
  metadata: jsonb('metadata').$type<{
    model?: string;
    tokensUsed?: number;
    cost?: number;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// AI Configurations table
export const aiConfigs = pgTable('ai_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'openai', 'anthropic', 'deepseek'
  model: text('model').notNull(),
  apiKey: text('api_key').notNull(),
  baseUrl: text('base_url'),
  parameters: jsonb('parameters').$type<{
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }>(),
  isDefault: integer('is_default').default(0), // 0 or 1 (boolean)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Export types
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type VerificationToken = typeof verification.$inferSelect;
export type NewVerificationToken = typeof verification.$inferInsert;
export type Novel = typeof novels.$inferSelect;
export type NewNovel = typeof novels.$inferInsert;
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type NewKnowledgeBase = typeof knowledgeBases.$inferInsert;
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type NewKnowledgeDocument = typeof knowledgeDocuments.$inferInsert;
export type OutlineVersion = typeof outlineVersions.$inferSelect;
export type NewOutlineVersion = typeof outlineVersions.$inferInsert;
export type Volume = typeof volumes.$inferSelect;
export type NewVolume = typeof volumes.$inferInsert;
export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
export type ChapterSnapshot = typeof chapterSnapshots.$inferSelect;
export type NewChapterSnapshot = typeof chapterSnapshots.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export const AIConfig = typeof aiConfigs.$inferSelect;
export const NewAIConfig = typeof aiConfigs.$inferInsert;
export type PlotThread = typeof plotThreads.$inferSelect;
export type NewPlotThread = typeof plotThreads.$inferInsert;
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type NewTimelineEvent = typeof timelineEvents.$inferInsert;

// Relations
import { relations } from 'drizzle-orm';

export const usersRelations = relations(user, ({ many }) => ({
  novels: many(novels),
  sessions: many(session),
  accounts: many(account),
}));

export const novelsRelations = relations(novels, ({ one, many }) => ({
  author: one(user, {
    fields: [novels.userId],
    references: [user.id],
  }),
  characters: many(characters),
  volumes: many(volumes),
  outlineVersions: many(outlineVersions),
  knowledgeBases: many(knowledgeBases),
  tasks: many(tasks),
  plotThreads: many(plotThreads),
  timelineEvents: many(timelineEvents),
}));

export const outlineVersionsRelations = relations(outlineVersions, ({ one }) => ({
  novel: one(novels, {
    fields: [outlineVersions.novelId],
    references: [novels.id],
  }),
}));

export const plotThreadsRelations = relations(plotThreads, ({ one }) => ({
  novel: one(novels, {
    fields: [plotThreads.novelId],
    references: [novels.id],
  }),
}));

export const timelineEventsRelations = relations(timelineEvents, ({ one }) => ({
  novel: one(novels, {
    fields: [timelineEvents.novelId],
    references: [novels.id],
  }),
}));

export const charactersRelations = relations(characters, ({ one }) => ({
  novel: one(novels, {
    fields: [characters.novelId],
    references: [novels.id],
  }),
}));

export const volumesRelations = relations(volumes, ({ one, many }) => ({
  novel: one(novels, {
    fields: [volumes.novelId],
    references: [novels.id],
  }),
  chapters: many(chapters),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  volume: one(volumes, {
    fields: [chapters.volumeId],
    references: [volumes.id],
  }),
  novel: one(novels, {
    fields: [chapters.novelId],
    references: [novels.id],
  }),
  tasks: many(tasks),
  snapshots: many(chapterSnapshots),
}));

export const chapterSnapshotsRelations = relations(chapterSnapshots, ({ one }) => ({
  chapter: one(chapters, {
    fields: [chapterSnapshots.chapterId],
    references: [chapters.id],
  }),
  novel: one(novels, {
    fields: [chapterSnapshots.novelId],
    references: [novels.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  novel: one(novels, {
    fields: [tasks.novelId],
    references: [novels.id],
  }),
  chapter: one(chapters, {
    fields: [tasks.chapterId],
    references: [chapters.id],
  }),
}));

export const knowledgeBasesRelations = relations(knowledgeBases, ({ one, many }) => ({
  novel: one(novels, {
    fields: [knowledgeBases.novelId],
    references: [novels.id],
  }),
  documents: many(knowledgeDocuments),
}));

export const knowledgeDocumentsRelations = relations(knowledgeDocuments, ({ one }) => ({
  knowledgeBase: one(knowledgeBases, {
    fields: [knowledgeDocuments.knowledgeBaseId],
    references: [knowledgeBases.id],
  }),
}));
