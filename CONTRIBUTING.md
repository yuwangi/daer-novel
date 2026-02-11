# 开发指南

## 项目架构

### 后端架构

```
apps/backend/
├── src/
│   ├── index.ts              # 服务器入口
│   ├── database/             # 数据库层
│   │   ├── index.ts          # 连接配置
│   │   ├── schema.ts         # Drizzle 模型
│   │   ├── migrate.ts        # 迁移脚本
│   │   └── seed.ts           # 种子数据
│   ├── services/ai/          # AI 服务层
│   │   ├── providers.ts      # AI 提供商抽象
│   │   └── agents.ts         # 7 个专业代理
│   ├── queue/                # 任务队列
│   │   └── worker.ts         # BullMQ Worker
│   ├── routes/               # API 路由
│   │   ├── auth.routes.ts
│   │   ├── novel.routes.ts
│   │   ├── task.routes.ts
│   │   └── ...
│   ├── middleware/           # 中间件
│   │   ├── auth.ts           # JWT 认证
│   │   └── errorHandler.ts  # 错误处理
│   ├── utils/                # 工具函数
│   │   └── logger.ts         # Winston 日志
│   └── types/                # TypeScript 类型
│       └── index.ts
```

### 前端架构

```
apps/frontend/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # 根布局
│   ├── page.tsx              # 首页
│   ├── login/                # 登录页
│   ├── register/             # 注册页
│   ├── novels/               # 小说管理
│   │   ├── page.tsx          # 列表页
│   │   ├── new/              # 创建向导
│   │   └── [id]/             # 详情页
│   ├── read/                 # 阅读器
│   └── settings/             # 设置页
├── components/               # React 组件
│   ├── ui/                   # 基础 UI 组件
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── ...
│   └── novel/                # 业务组件
│       ├── CharacterManager.tsx
│       └── ChapterGenerator.tsx
├── lib/                      # 工具库
│   ├── api.ts                # API 客户端
│   ├── utils.ts              # 工具函数
│   └── store.ts              # Zustand 状态管理
└── styles/
    └── globals.css           # 全局样式
```

## 核心概念

### AI 代理工作流

1. **OutlineAgent** - 根据小说设定生成完整大纲
2. **TitleAgent** - 基于大纲生成书名建议
3. **ChapterPlanningAgent** - 规划卷/章节结构
4. **ChapterOutlineAgent** - 为每章生成大纲
5. **ChapterDetailAgent** - 生成详细情节点
6. **ContentAgent** - 生成章节正文
7. **ConsistencyAgent** - 校验内容一致性

### 任务队列流程

```
用户触发 → 创建 Task → 加入 BullMQ 队列
                ↓
            Worker 处理
                ↓
        调用对应 AI Agent
                ↓
        流式生成 + WebSocket 推送
                ↓
        保存结果 + 更新状态
```

### WebSocket 事件

- `subscribe:task` - 订阅任务更新
- `task:progress` - 进度更新
- `task:chunk` - 内容片段（流式）
- `task:completed` - 任务完成
- `task:failed` - 任务失败

## 开发规范

### 代码风格

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用 Prettier 格式化
- 组件使用函数式 + Hooks

### 命名规范

- 组件：PascalCase（`CharacterManager.tsx`）
- 函数/变量：camelCase（`loadNovel`）
- 常量：UPPER_SNAKE_CASE（`API_URL`）
- 类型/接口：PascalCase（`Novel`, `Character`）

### Git 提交规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

## 常用命令

### 开发

```bash
# 启动开发服务器
npm run dev

# 分别启动
cd apps/backend && npm run dev
cd apps/frontend && npm run dev
```

### 数据库

```bash
cd apps/backend

# 生成迁移
npm run migration:generate

# 执行迁移
npm run migration:run

# 填充数据
npm run seed
```

### Docker

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 重启服务
docker-compose restart backend

# 停止并删除
docker-compose down -v
```

### 测试

```bash
# 运行系统测试
./test.sh

# 后端测试
cd apps/backend && npm test

# 前端测试
cd apps/frontend && npm test
```

## 调试技巧

### 后端调试

1. 查看日志文件：`tail -f apps/backend/logs/combined.log`
2. 使用 Winston 日志级别：`logger.debug()`, `logger.info()`, `logger.error()`
3. 数据库查询：使用 Drizzle Studio 或 psql

### 前端调试

1. 使用 React DevTools
2. 检查 Network 标签（API 请求）
3. 查看 WebSocket 连接状态
4. 使用 `console.log` 或 Chrome Debugger

### 常见问题

**Q: 数据库连接失败？**
```bash
# 检查 Docker 容器
docker ps | grep postgres

# 查看日志
docker logs daer-novel-postgres
```

**Q: WebSocket 连接失败？**
```bash
# 检查后端是否启动
curl http://localhost:8002/health

# 检查 CORS 配置
# 确保 .env 中 CORS_ORIGIN 正确
```

**Q: AI 生成失败？**
```bash
# 检查 API 密钥
cat .env | grep API_KEY

# 查看后端日志
tail -f apps/backend/logs/error.log
```

## 性能优化

### 后端优化

- 使用数据库索引
- 实现 Redis 缓存
- 优化 AI 提示词长度
- 使用连接池

### 前端优化

- 使用 Next.js Image 优化
- 实现虚拟滚动（长列表）
- 懒加载组件
- 使用 React.memo 避免重渲染

## 部署

### 生产环境配置

1. 修改 `.env` 中的密钥和 URL
2. 设置 `NODE_ENV=production`
3. 配置 HTTPS
4. 使用 PM2 或 Docker 部署

### Docker 部署

```bash
# 构建镜像
docker-compose build

# 启动生产环境
docker-compose -f docker-compose.prod.yml up -d
```

## 贡献指南

1. Fork 项目
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

## 资源链接

- [Next.js 文档](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [BullMQ](https://docs.bullmq.io/)
- [OpenAI API](https://platform.openai.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
