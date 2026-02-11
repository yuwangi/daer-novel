# Daer Novel - AI 小说生成平台

一个基于多智能体协作的 AI 长篇小说生成平台，支持从设定到连载的全流程创作。

## ✨ 核心特性

- 🤖 **7 个专业 AI 代理** - 分工协作完成从大纲到正文的生成
- 📚 **结构化知识库** - 保证长篇连载的世界观一致性
- ⚡ **异步任务队列** - BullMQ + WebSocket 实时进度推送
- 🎨 **现代化 UI** - Next.js 14 + 玻璃态设计
- 🔌 **多 AI 提供商** - 支持 OpenAI、Claude、DeepSeek

## 🚀 快速开始

### 前置要求

- Node.js >= 18
- Docker & Docker Compose
- npm >= 9

### 一键启动

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd daer-novel

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 AI API 密钥

# 3. 运行启动脚本
chmod +x start.sh
./start.sh
```

访问：
- 前端：http://localhost:8001
- 后端：http://localhost:8002
- API 文档：http://localhost:8002/api-docs

详细安装指南请查看 [SETUP.md](./SETUP.md)

## 📖 文档

- [SETUP.md](./SETUP.md) - 详细安装和配置指南
- [API.md](./API.md) - 完整 API 接口文档
- [walkthrough.md](./brain/walkthrough.md) - 功能详解和使用说明

## 🏗️ 技术栈

### 后端
- Express.js - 轻量级 Web 框架
- PostgreSQL + pgvector - 数据库和向量检索
- Drizzle ORM - 类型安全的 ORM
- BullMQ + Redis - 任务队列
- Socket.IO - WebSocket 实时通信
- JWT - 身份认证

### 前端
- Next.js 14 - React 框架（App Router）
- TypeScript - 类型安全
- Tailwind CSS - 样式框架
- Socket.IO Client - 实时通信
- Zustand - 状态管理（规划中）

### AI 集成
- OpenAI SDK
- Anthropic SDK
- 自定义提供商抽象层

## 🎯 AI 代理系统

| 代理 | 功能 | 输入 | 输出 |
|------|------|------|------|
| OutlineAgent | 生成全文大纲 | 小说设定 | 完整故事大纲 |
| TitleAgent | 生成书名 | 大纲 | 3-5 个书名建议 |
| ChapterPlanningAgent | 章节结构规划 | 大纲 | 卷/章节结构 |
| ChapterOutlineAgent | 章节大纲 | 章节信息 | 章节大纲 |
| ChapterDetailAgent | 章节细纲 | 章节大纲 | 详细情节点 |
| ContentAgent | 正文生成 | 细纲 | 章节正文 |
| ConsistencyAgent | 一致性校验 | 生成内容 | 校验结果 |

## 📁 项目结构

```
daer-novel/
├── apps/
│   ├── backend/              # Express 后端
│   │   ├── src/
│   │   │   ├── database/     # 数据库配置和模型
│   │   │   ├── services/ai/  # AI 提供商和代理
│   │   │   ├── queue/        # BullMQ 任务队列
│   │   │   ├── routes/       # API 路由
│   │   │   ├── middleware/   # 中间件
│   │   │   └── utils/        # 工具函数
│   │   └── package.json
│   └── frontend/             # Next.js 前端
│       ├── app/              # 页面路由
│       ├── components/       # React 组件
│       ├── lib/              # 工具库
│       └── package.json
├── docker-compose.yml        # Docker 编排
├── .env.example              # 环境变量模板
└── README.md
```

## 🔧 开发

### 启动开发服务器

```bash
# 方式一：同时启动前后端（Web 模式）
pnpm run dev

# 方式二：桌面端开发模式（Tauri）
pnpm run tauri:dev

# 方式三：分别启动
cd apps/backend && pnpm run dev
cd apps/frontend && pnpm run dev
```

### 应用打包 (Tauri)

支持打包为各个系统的原生应用：

```bash
# 生成当前系统的安装包
pnpm run tauri:build
```

> **注意**：打包前请确保已安装 [Rust](https://www.rust-lang.org/) 环境。

### 自动化发布 (GitHub Actions)

项目已配置 GitHub Actions 自动化流水线。当你向仓库推送版本标签时，会自动触发多平台构建并在 GitHub Releases 中创建草案：

```bash
git tag v1.0.0
git push origin v1.0.0
```

提示：请确保在 GitHub 仓库设置中开启了 `Actions` 权限，并确保 `GITHUB_TOKEN` 具有写入权限。

### 数据库操作

```bash
cd apps/backend

# 生成迁移
npm run migration:generate

# 执行迁移
npm run migration:run

# 填充演示数据
npm run seed
```

## 🧪 测试流程

1. 注册账户：http://localhost:8001/register
2. 创建小说：选择类型、风格、填写背景
3. 生成大纲：进入小说详情 → 大纲标签 → AI 生成
4. 添加人物：人物卡标签 → 添加主角、配角
5. 生成章节：章节标签 → 生成章节结构
6. 查看内容：阅读器查看生成的正文

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- LobeHub - 架构设计灵感
- OpenAI、Anthropic - AI 能力支持
- 所有开源项目贡献者

---

**开始你的 AI 创作之旅！** 🎉
