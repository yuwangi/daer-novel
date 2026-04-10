# 幂等性修复测试指南

## 修复内容总结

### 1. 前端修复

#### ChapterGenerator.tsx

- 添加了防重复点击的 ref 检查机制
- 使用 `isGeneratingVolumeRef`、`isGeneratingChapterRef`、`isGeneratingContentRef` 等 ref 进行同步检查
- 在关键操作（生成分卷、生成章节、生成内容、保存草稿）前添加检查
- 操作完成后延迟重置 ref，确保状态更新完成

#### page.tsx (novels/detail)

- 添加了 `isGeneratingOutlineRef` 用于大纲生成防重复点击
- 在 `handleGenerateOutlineStream` 函数中添加检查

#### use-async-action.ts (新增)

- 创建了通用的防重复点击 Hook
- 提供 `useAsyncAction` 和 `useAsyncActionMap` 两个 Hook
- 使用 ref 进行同步检查，避免状态更新延迟问题

### 2. 后端修复

#### task.routes.ts

- 添加了幂等性检查函数 `checkExistingTask` 和 `checkNovelLevelConflict`
- 在以下端点添加幂等性检查：
  - `POST /:novelId/generate/outline` - 大纲生成
  - `POST /:novelId/generate/titles` - 标题生成
  - `POST /:novelId/generate/volumes` - 分卷规划
  - `POST /:novelId/generate/chapters` - 章节规划
  - `POST /:novelId/chapters/:chapterId/generate` - 章节内容生成
- 如果存在进行中的相同任务，返回 409 状态码和错误信息

#### worker.ts

- 添加了内存级别的幂等性检查
- 使用 `processingTasks` Set 跟踪正在处理的任务
- 添加了 `isTaskProcessing`、`markTaskProcessing`、`markTaskCompleted` 函数
- 添加了 `canExecuteTask` 函数检查数据库状态
- Worker 处理任务时进行双重检查：
  1. 内存级别：检查是否已经在处理中
  2. 数据库级别：检查任务状态是否为 queued 或 failed
- 在 finally 块中确保任务标记为完成

## 测试步骤

### 前端测试

1. **大纲生成防重复点击测试**
   - 进入小说详情页
   - 快速连续点击 "AI 生成大纲" 按钮
   - 预期：只有第一次点击生效，后续点击显示提示信息

2. **分卷规划防重复点击测试**
   - 进入章节管理
   - 点击 "AI 规划分卷"
   - 快速连续点击确认
   - 预期：只有第一次点击生效

3. **章节生成防重复点击测试**
   - 选择一个分卷
   - 点击 "生成章节结构"
   - 快速连续点击确认
   - 预期：只有第一次点击生效

4. **章节内容生成防重复点击测试**
   - 选择一个章节
   - 点击 "生成正文"
   - 快速连续点击确认
   - 预期：只有第一次点击生效

### 后端测试

1. **API 幂等性测试**

   ```bash
   # 发送第一个请求
   curl -X POST http://localhost:8002/api/novels/{novelId}/generate/outline \
     -H "Content-Type: application/json" \
     -c cookies.txt

   # 在第一个任务完成前发送第二个请求
   curl -X POST http://localhost:8002/api/novels/{novelId}/generate/outline \
     -H "Content-Type: application/json" \
     -c cookies.txt

   # 预期第二个请求返回 409 状态码
   ```

2. **Worker 幂等性测试**
   - 观察日志，确保同一任务不会被重复处理
   - 检查日志中是否有 "Task X is already being processed, skipping duplicate execution"

## 预期行为

### 正常流程

1. 用户点击生成按钮
2. 前端检查通过（ref 为 false）
3. 设置 ref 为 true
4. 发送请求到后端
5. 后端检查通过（无进行中的相同任务）
6. 创建任务并加入队列
7. Worker 处理任务
8. 任务完成，前端重置 ref

### 重复点击场景

1. 用户点击生成按钮
2. 前端检查通过（ref 为 false）
3. 设置 ref 为 true
4. 用户再次点击（在请求完成前）
5. 前端检查失败（ref 为 true），显示提示信息
6. 第一个请求完成后重置 ref

### 后端重复请求场景

1. 前端发送请求
2. 后端检查通过，创建任务
3. 前端由于网络延迟再次发送请求
4. 后端检查发现已有进行中的任务
5. 返回 409 状态码，前端显示提示信息

### Worker 重复处理场景

1. 任务被加入队列
2. Worker 开始处理任务，标记为 processing
3. 由于某些原因（如网络延迟），同一任务被再次投递
4. Worker 检查发现任务已在 processing 中，跳过执行
5. 或者检查发现数据库状态不为 queued/failed，跳过执行

## 脏数据防护

修复后，以下场景不会产生脏数据：

1. ✅ 用户快速连续点击生成按钮
2. ✅ 前端状态更新延迟导致重复请求
3. ✅ 网络延迟导致重复提交
4. ✅ Worker 重复处理同一任务
5. ✅ 同一小说同时进行多个大纲生成任务
6. ✅ 同一章节同时进行多个内容生成任务
