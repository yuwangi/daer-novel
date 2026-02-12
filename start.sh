#!/bin/bash

# 增加文件描述符限制，解决 EMFILE: too many open files 错误 (macOS)
ulimit -n 10240

echo "🚀 Daer Novel - 快速启动脚本"
echo "================================"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未安装 Docker"
    echo "请先安装 Docker: https://www.docker.com/get-started"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "📝 创建 .env 文件..."
    cp .env.example .env
    echo "⚠️  请编辑 .env 文件，填入你的 AI API 密钥"
    echo "   - OPENAI_API_KEY"
    echo "   - ANTHROPIC_API_KEY (可选)"
    echo "   - DEEPSEEK_API_KEY (可选)"
    read -p "按 Enter 继续..."
fi

# 检查并清理端口
echo ""
echo "🔍 检查端口占用..."

# 清理端口 8001 (前端)
PID_FE=$(lsof -ti :8001)
if [ ! -z "$PID_FE" ]; then
    echo "⚠️  端口 8001 被占用 (PID: $PID_FE)，正在终止..."
    kill -9 $PID_FE
    echo "✅ 端口 8001 已释放"
fi

# 清理端口 8002 (后端)
PID_BE=$(lsof -ti :8002)
if [ ! -z "$PID_BE" ]; then
    echo "⚠️  端口 8002 被占用 (PID: $PID_BE)，正在终止..."
    kill -9 $PID_BE
    echo "✅ 端口 8002 已释放"
fi

# 安装依赖
echo ""
echo "📦 安装项目依赖..."
pnpm install

# 启动 Docker 服务
echo ""
echo "🐳 启动 Docker 服务..."
docker-compose up -d --force-recreate postgres redis

# 等待数据库就绪
echo "⏳ 等待数据库启动..."
sleep 5

# 执行数据库迁移
echo ""
echo "🗄️  执行数据库迁移..."
pnpm db:migrate

echo ""
echo "✅ 环境准备完成！"
echo "================================"
echo "请选择启动模式:"
echo "1) Web 模式 (浏览器访问)"
echo "2) 桌面端模式 (Tauri)"
echo "================================"
read -p "请输入选项 (1/2): " START_MODE

if [ "$START_MODE" == "2" ]; then
    echo "🚀 正在启动 桌面端模式..."
    echo "💡 提示: 后端服务将在后台运行"
    pnpm run dev:backend & 
    pnpm run tauri:dev
else
    echo "🚀 正在启动 Web 模式..."
    pnpm run dev
fi
