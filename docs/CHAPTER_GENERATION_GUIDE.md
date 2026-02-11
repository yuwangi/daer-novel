# 章节生成完整流程

## 📋 生成流程

### 1. 大纲生成
```
用户输入小说设定
    ↓
OutlineAgent 生成全文大纲
    ↓
保存到 novels.outline
```

### 2. 章节结构规划
```
用户确认大纲
    ↓
ChapterPlanningAgent 规划卷/章节
    ↓
创建 volumes 和 chapters 记录
```

### 3. 章节大纲生成
```
选择章节
    ↓
ChapterOutlineAgent 生成章节大纲
    ↓
保存到 chapters.outline
```

### 4. 章节细纲生成
```
基于章节大纲
    ↓
ChapterDetailAgent 生成详细情节点
    ↓
保存到 chapters.detailOutline
```

### 5. 正文内容生成 ⭐
```
基于细纲 + 知识库检索
    ↓
ContentAgent 生成正文
    ↓
ConsistencyAgent 校验一致性
    ↓
保存到 chapters.content
```

## 🔄 实时进度追踪

### WebSocket 事件流

```javascript
// 1. 用户触发生成
POST /api/novels/:novelId/chapters/:chapterId/generate

// 2. 创建任务并加入队列
Task created → BullMQ Queue

// 3. Worker 开始处理
Worker picks up task

// 4. 实时进度推送
socket.emit('task:progress', {
  taskId,
  progress: 10,
  message: '分析章节大纲...'
})

socket.emit('task:progress', {
  taskId,
  progress: 30,
  message: '检索相关知识库...'
})

socket.emit('task:chunk', {
  taskId,
  chunk: '清晨的阳光透过窗棂...'
})

// 5. 完成通知
socket.emit('task:completed', {
  taskId,
  result: {
    content: '完整章节内容...',
    wordCount: 3200,
    tokensUsed: 1500
  }
})
```

## 🎨 前端实现

### ChapterGenerator 组件

**功能：**
- 显示所有章节列表
- 章节状态标识（待生成/生成中/已完成/失败）
- 实时进度条
- 预览和编辑按钮

**状态管理：**
```typescript
const [generatingChapterId, setGeneratingChapterId] = useState<string | null>(null);
const [generationProgress, setGenerationProgress] = useState(0);
const [generationStatus, setGenerationStatus] = useState('');
```

**WebSocket 集成：**
```typescript
socket.on('task:progress', (data) => {
  setGenerationProgress(data.progress);
  setGenerationStatus(data.message);
});

socket.on('task:chunk', (data) => {
  // 实时显示生成的内容片段
  appendContent(data.chunk);
});

socket.on('task:completed', (data) => {
  setGenerationProgress(100);
  onUpdate(); // 刷新章节列表
});
```

## 🤖 AI 生成策略

### ContentAgent 提示词结构

```
系统角色：你是一位专业的网络小说作家

上下文信息：
- 小说类型：{genre}
- 写作风格：{style}
- 世界观设定：{worldSettings}
- 人物信息：{characters}
- 前文摘要：{previousChaptersSummary}

知识库检索结果：
{relevantKnowledge}

章节细纲：
{detailOutline}

要求：
1. 字数：{minChapterWords} - {maxChapterWords} 字
2. 保持人物性格一致
3. 遵循世界观设定
4. 情节连贯自然
5. 语言流畅生动

请生成章节正文：
```

### 知识库检索

```typescript
// 1. 提取章节关键信息
const keywords = extractKeywords(chapter.outline);

// 2. 语义搜索相关知识
const relevantDocs = await knowledgeAPI.search(
  novelId,
  knowledgeBaseId,
  keywords.join(' '),
  5
);

// 3. 注入到提示词
const context = relevantDocs.map(doc => doc.content).join('\n\n');
```

## 📊 生成进度阶段

| 进度 | 阶段 | 说明 |
|------|------|------|
| 0-10% | 准备阶段 | 加载章节信息、检查前置条件 |
| 10-30% | 知识检索 | 从知识库中检索相关设定 |
| 30-50% | 细纲生成 | 生成详细情节点（如未生成） |
| 50-80% | 正文生成 | AI 生成章节内容（流式输出） |
| 80-95% | 一致性校验 | 检查人物、设定一致性 |
| 95-100% | 保存完成 | 保存到数据库、更新状态 |

## 🔧 错误处理

### 常见错误

1. **API 限流**
   - 错误：Rate limit exceeded
   - 处理：延迟重试，显示等待时间

2. **生成超时**
   - 错误：Generation timeout
   - 处理：保存已生成部分，允许继续生成

3. **内容违规**
   - 错误：Content policy violation
   - 处理：提示用户修改设定，重新生成

4. **知识库为空**
   - 警告：No knowledge base found
   - 处理：提示用户添加知识库（可选）

### 重试机制

```typescript
const MAX_RETRIES = 3;
let retryCount = 0;

async function generateWithRetry() {
  try {
    return await generateChapter();
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      await delay(1000 * retryCount); // 指数退避
      return generateWithRetry();
    }
    throw error;
  }
}
```

## 💾 内容保存策略

### 自动保存

- 每生成 500 字自动保存一次
- 保存为草稿状态
- 支持断点续写

### 版本控制

```typescript
interface ChapterVersion {
  id: string;
  chapterId: string;
  content: string;
  version: number;
  createdAt: Date;
}

// 每次重新生成创建新版本
await db.insert(chapterVersions).values({
  chapterId,
  content,
  version: currentVersion + 1,
});
```

## 🎯 优化建议

### 性能优化

1. **流式生成**
   - 使用 Server-Sent Events 或 WebSocket
   - 边生成边显示，提升用户体验

2. **并行生成**
   - 支持同时生成多个章节
   - 使用队列控制并发数

3. **缓存策略**
   - 缓存知识库检索结果
   - 缓存 AI 提示词模板

### 用户体验

1. **进度可视化**
   - 详细的进度条
   - 当前阶段说明
   - 预计剩余时间

2. **内容预览**
   - 实时显示生成片段
   - 支持暂停查看
   - 不满意可中止重生成

3. **编辑友好**
   - 生成后可直接编辑
   - 支持部分重生成
   - 保留编辑历史

---

**完整的章节生成系统已就绪！** 🚀
