#!/bin/bash

echo "🚀 Daer Novel - 快速启动脚本"
# 增加文件描述符限制，解决 EMFILE: too many open files 错误 (macOS)
ulimit -n 65536 2>/dev/null || ulimit -n 10240
echo "🔧 System File Limit: $(ulimit -n)"
echo "================================"

# 检查端口是否可用的函数
is_port_available() {
    local port=$1
    # 使用 lsof 检查端口是否被占用
    if lsof -ti :$port > /dev/null 2>&1; then
        return 1  # 端口被占用
    else
        return 0  # 端口可用
    fi
}

# 查找可用端口对的函数
find_available_ports() {
    local base_port=$1
    local max_attempts=100
    
    for ((i=0; i<max_attempts; i++)); do
        local fe_port=$((base_port + i * 10))
        local be_port=$((fe_port + 1))
        
        if is_port_available $fe_port && is_port_available $be_port; then
            echo "$fe_port $be_port"
            return 0
        fi
    done
    
    echo ""
    return 1
}

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

# 从 .env 读取端口配置（如果存在）
if [ -f .env ]; then
    FRONTEND_PORT=$(grep -E "^FRONTEND_PORT=" .env | cut -d'=' -f2)
    BACKEND_PORT=$(grep -E "^BACKEND_PORT=" .env | cut -d'=' -f2)
fi

# 如果 .env 中没有配置，使用默认值
FRONTEND_PORT=${FRONTEND_PORT:-8001}
BACKEND_PORT=${BACKEND_PORT:-8002}

# 检查端口占用
echo ""
echo "🔍 检查端口占用..."

# 检查前端端口
PID_FE=$(lsof -ti :$FRONTEND_PORT 2>/dev/null)
# 检查后端端口
PID_BE=$(lsof -ti :$BACKEND_PORT 2>/dev/null)

# 标记是否有端口被占用
PORT_CONFLICT=false

if [ ! -z "$PID_FE" ]; then
    echo "⚠️  前端端口 $FRONTEND_PORT 被占用 (PID: $PID_FE)"
    PORT_CONFLICT=true
fi

if [ ! -z "$PID_BE" ]; then
    echo "⚠️  后端端口 $BACKEND_PORT 被占用 (PID: $PID_BE)"
    PORT_CONFLICT=true
fi

# 如果有端口冲突，询问用户如何处理
if [ "$PORT_CONFLICT" = true ]; then
    echo ""
    echo "⚠️  检测到端口冲突！"
    echo "================================"
    echo "请选择处理方式:"
    echo "1) 终止占用进程并继续 (可能影响其他项目)"
    echo "2) 自动选择新端口并启动 (推荐，一键并行运行)"
    echo "3) 修改端口后继续"
    echo "4) 取消启动"
    echo "================================"
    read -p "请输入选项 (1/2/3/4): " PORT_CHOICE
    
    case $PORT_CHOICE in
        1)
            # 终止占用进程
            if [ ! -z "$PID_FE" ]; then
                echo "🔨 终止前端端口 $FRONTEND_PORT 的进程 (PID: $PID_FE)..."
                kill -9 $PID_FE 2>/dev/null
                echo "✅ 前端端口 $FRONTEND_PORT 已释放"
            fi
            if [ ! -z "$PID_BE" ]; then
                echo "🔨 终止后端端口 $BACKEND_PORT 的进程 (PID: $PID_BE)..."
                kill -9 $PID_BE 2>/dev/null
                echo "✅ 后端端口 $BACKEND_PORT 已释放"
            fi
            ;;
        2)
            # 自动选择新端口并启动
            echo ""
            echo "🔍 正在查找可用端口..."
            
            # 从当前端口开始查找
            PORTS=$(find_available_ports $FRONTEND_PORT)
            
            if [ -z "$PORTS" ]; then
                echo "❌ 未找到可用端口，请尝试手动修改配置"
                exit 1
            fi
            
            # 解析找到的端口
            NEW_FE_PORT=$(echo $PORTS | cut -d' ' -f1)
            NEW_BE_PORT=$(echo $PORTS | cut -d' ' -f2)
            
            echo "✅ 找到可用端口:"
            echo "   前端端口: $NEW_FE_PORT"
            echo "   后端端口: $NEW_BE_PORT"
            echo ""
            echo "🔧 正在配置环境变量..."
            
            # 设置环境变量，这些变量将在启动时被使用
            export FRONTEND_PORT=$NEW_FE_PORT
            export BACKEND_PORT=$NEW_BE_PORT
            export NEXT_PUBLIC_API_URL="http://localhost:$NEW_BE_PORT"
            export CORS_ORIGIN="http://localhost:$NEW_FE_PORT"
            export AUTH_BASE_URL="http://localhost:$NEW_BE_PORT/api/auth"
            
            echo "✅ 环境变量已配置:"
            echo "   FRONTEND_PORT=$FRONTEND_PORT"
            echo "   BACKEND_PORT=$BACKEND_PORT"
            echo "   NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
            echo "   CORS_ORIGIN=$CORS_ORIGIN"
            echo "   AUTH_BASE_URL=$AUTH_BASE_URL"
            echo ""
            echo "💡 提示: 这些环境变量仅对本次启动有效，不会修改配置文件"
            echo "   前端将在: http://localhost:$NEW_FE_PORT"
            echo "   后端将在: http://localhost:$NEW_BE_PORT"
            ;;
        3)
            # 修改端口
            echo ""
            echo "💡 提示: 请修改 .env 文件中的端口配置"
            echo "   - FRONTEND_PORT: 前端端口 (当前: $FRONTEND_PORT)"
            echo "   - BACKEND_PORT: 后端端口 (当前: $BACKEND_PORT)"
            echo "   - NEXT_PUBLIC_API_URL: 前端调用后端的地址"
            echo "   - CORS_ORIGIN: 后端允许的前端地址"
            echo "   - AUTH_BASE_URL: 认证基础 URL"
            echo ""
            echo "📝 示例配置（使用新端口）:"
            echo "   FRONTEND_PORT=8011"
            echo "   BACKEND_PORT=8012"
            echo "   NEXT_PUBLIC_API_URL=http://localhost:8012"
            echo "   CORS_ORIGIN=http://localhost:8011,https://novel.daerai.com"
            echo "   AUTH_BASE_URL=http://localhost:8012/api/auth"
            echo ""
            
            # 检查是否有 .env 文件
            if [ -f .env ]; then
                read -p "是否现在打开 .env 文件进行编辑? (y/n): " EDIT_NOW
                if [ "$EDIT_NOW" == "y" ] || [ "$EDIT_NOW" == "Y" ]; then
                    # 尝试使用用户的默认编辑器
                    if [ ! -z "$EDITOR" ]; then
                        $EDITOR .env
                    elif command -v nano &> /dev/null; then
                        nano .env
                    elif command -v vim &> /dev/null; then
                        vim .env
                    elif command -v code &> /dev/null; then
                        code .env
                    else
                        echo "⚠️  未找到编辑器，请手动编辑 .env 文件"
                    fi
                    echo ""
                    echo "📝 请重新运行 start.sh 以使用新的端口配置"
                    exit 0
                fi
            else
                echo "⚠️  未找到 .env 文件，请先运行脚本创建"
                exit 1
            fi
            ;;
        4)
            # 取消启动
            echo "❌ 已取消启动"
            exit 0
            ;;
        *)
            # 默认选项：取消
            echo "⚠️  无效选项，已取消启动"
            exit 1
            ;;
    esac
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
