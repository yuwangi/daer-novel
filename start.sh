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

# 检查 Docker 容器是否正在运行
is_container_running() {
    local container_name=$1
    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        return 0  # 容器正在运行
    else
        return 1  # 容器未运行
    fi
}

# 检查 Docker 容器是否存在（包括停止的）
is_container_exists() {
    local container_name=$1
    if docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
        return 0  # 容器存在
    else
        return 1  # 容器不存在
    fi
}

# 检查端口是否被 Docker 容器占用
is_port_used_by_docker() {
    local port=$1
    # 使用 docker ps 检查端口映射
    if docker ps --format '{{.Ports}}' | grep -q ":${port}->"; then
        return 0  # 端口被 Docker 容器占用
    else
        return 1  # 端口未被 Docker 容器占用
    fi
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

# 设置 Next.js 使用的 PORT 环境变量
export PORT=$FRONTEND_PORT

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
            export PORT=$NEW_FE_PORT
            export NEXT_PUBLIC_API_URL="http://localhost:$NEW_BE_PORT"
            export CORS_ORIGIN="http://localhost:$NEW_FE_PORT"
            export AUTH_BASE_URL="http://localhost:$NEW_BE_PORT/api/auth"
            
            echo "✅ 环境变量已配置:"
            echo "   FRONTEND_PORT=$FRONTEND_PORT"
            echo "   BACKEND_PORT=$BACKEND_PORT"
            echo "   PORT=$PORT (Next.js 使用此端口)"
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

# Docker 容器名称和端口配置
POSTGRES_CONTAINER="daer-novel-postgres"
REDIS_CONTAINER="daer-novel-redis"
POSTGRES_PORT=5789
REDIS_PORT=6379

# 检查 Docker 容器和端口状态
echo "🔍 检查 Docker 容器状态..."

# 标记是否有 Docker 端口冲突
DOCKER_PORT_CONFLICT=false
DOCKER_CONFLICT_MESSAGE=""

# 检查 Postgres 容器和端口
if is_container_running $POSTGRES_CONTAINER; then
    echo "✅ Postgres 容器已在运行 ($POSTGRES_CONTAINER)"
else
    # 检查端口是否被占用（不是我们的容器）
    if ! is_port_available $POSTGRES_PORT; then
        if is_port_used_by_docker $POSTGRES_PORT; then
            DOCKER_PORT_CONFLICT=true
            DOCKER_CONFLICT_MESSAGE="$DOCKER_CONFLICT_MESSAGE⚠️  Postgres 端口 $POSTGRES_PORT 被其他 Docker 容器占用\n"
        else
            DOCKER_PORT_CONFLICT=true
            DOCKER_CONFLICT_MESSAGE="$DOCKER_CONFLICT_MESSAGE⚠️  Postgres 端口 $POSTGRES_PORT 被非 Docker 进程占用\n"
        fi
    fi
fi

# 检查 Redis 容器和端口
if is_container_running $REDIS_CONTAINER; then
    echo "✅ Redis 容器已在运行 ($REDIS_CONTAINER)"
else
    # 检查端口是否被占用（不是我们的容器）
    if ! is_port_available $REDIS_PORT; then
        if is_port_used_by_docker $REDIS_PORT; then
            DOCKER_PORT_CONFLICT=true
            DOCKER_CONFLICT_MESSAGE="$DOCKER_CONFLICT_MESSAGE⚠️  Redis 端口 $REDIS_PORT 被其他 Docker 容器占用\n"
        else
            DOCKER_PORT_CONFLICT=true
            DOCKER_CONFLICT_MESSAGE="$DOCKER_CONFLICT_MESSAGE⚠️  Redis 端口 $REDIS_PORT 被非 Docker 进程占用\n"
        fi
    fi
fi

# 如果有 Docker 端口冲突，询问用户如何处理
if [ "$DOCKER_PORT_CONFLICT" = true ]; then
    echo ""
    echo "⚠️  检测到 Docker 端口冲突！"
    echo "================================"
    echo -e "$DOCKER_CONFLICT_MESSAGE"
    echo "================================"
    echo "请选择处理方式:"
    echo "1) 尝试启动现有容器 (如果存在但未运行)"
    echo "2) 终止占用端口的容器/进程并重新启动 (可能影响其他项目)"
    echo "3) 跳过 Docker 启动 (假设数据库和 Redis 已在其他地方运行)"
    echo "4) 取消启动"
    echo "================================"
    read -p "请输入选项 (1/2/3/4): " DOCKER_CHOICE
    
    case $DOCKER_CHOICE in
        1)
            # 尝试启动现有容器
            echo ""
            echo "🔍 检查是否存在已停止的容器..."
            
            # 启动 Postgres 容器（如果存在但未运行）
            if is_container_exists $POSTGRES_CONTAINER && ! is_container_running $POSTGRES_CONTAINER; then
                echo "🔨 启动 Postgres 容器 ($POSTGRES_CONTAINER)..."
                docker start $POSTGRES_CONTAINER
            elif ! is_container_exists $POSTGRES_CONTAINER; then
                echo "⚠️  Postgres 容器不存在，需要创建新容器"
                if ! is_port_available $POSTGRES_PORT; then
                    echo "❌ Postgres 端口 $POSTGRES_PORT 仍被占用，无法创建新容器"
                    echo "💡 请选择选项 2 终止占用进程，或选择选项 3 跳过 Docker 启动"
                    exit 1
                fi
            fi
            
            # 启动 Redis 容器（如果存在但未运行）
            if is_container_exists $REDIS_CONTAINER && ! is_container_running $REDIS_CONTAINER; then
                echo "🔨 启动 Redis 容器 ($REDIS_CONTAINER)..."
                docker start $REDIS_CONTAINER
            elif ! is_container_exists $REDIS_CONTAINER; then
                echo "⚠️  Redis 容器不存在，需要创建新容器"
                if ! is_port_available $REDIS_PORT; then
                    echo "❌ Redis 端口 $REDIS_PORT 仍被占用，无法创建新容器"
                    echo "💡 请选择选项 2 终止占用进程，或选择选项 3 跳过 Docker 启动"
                    exit 1
                fi
            fi
            
            # 使用 docker-compose up -d 启动（不会强制重建，只启动需要的）
            echo ""
            echo "🔨 启动 Docker 服务 (postgres 和 redis)..."
            docker-compose up -d postgres redis
            ;;
        2)
            # 终止占用端口的容器/进程并重新启动
            echo ""
            echo "🔨 终止占用端口的容器/进程..."
            
            # 终止占用 Postgres 端口的进程
            if ! is_port_available $POSTGRES_PORT; then
                POSTGRES_PID=$(lsof -ti :$POSTGRES_PORT 2>/dev/null)
                if [ ! -z "$POSTGRES_PID" ]; then
                    echo "🔨 终止占用 Postgres 端口 $POSTGRES_PORT 的进程 (PID: $POSTGRES_PID)..."
                    kill -9 $POSTGRES_PID 2>/dev/null
                fi
            fi
            
            # 终止占用 Redis 端口的进程
            if ! is_port_available $REDIS_PORT; then
                REDIS_PID=$(lsof -ti :$REDIS_PORT 2>/dev/null)
                if [ ! -z "$REDIS_PID" ]; then
                    echo "🔨 终止占用 Redis 端口 $REDIS_PORT 的进程 (PID: $REDIS_PID)..."
                    kill -9 $REDIS_PID 2>/dev/null
                fi
            fi
            
            # 等待端口释放
            sleep 2
            
            # 使用 docker-compose up -d 启动（不会强制重建，只启动需要的）
            echo ""
            echo "🔨 启动 Docker 服务 (postgres 和 redis)..."
            docker-compose up -d postgres redis
            ;;
        3)
            # 跳过 Docker 启动
            echo ""
            echo "⏭️  跳过 Docker 启动"
            echo "💡 假设 PostgreSQL 和 Redis 已在其他地方运行"
            echo "💡 请确保数据库连接配置正确"
            SKIP_DOCKER=true
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
else
    # 没有端口冲突，正常启动
    echo "✅ 没有检测到 Docker 端口冲突"
    echo ""
    echo "🔨 启动 Docker 服务 (postgres 和 redis)..."
    # 使用 docker-compose up -d 启动（不会强制重建，只启动需要的）
    # 如果容器已存在且运行中，不会做任何操作
    # 如果容器已存在但停止，会启动它
    # 如果容器不存在，会创建并启动它
    docker-compose up -d postgres redis
fi

# 等待数据库就绪（如果没有跳过 Docker）
if [ "$SKIP_DOCKER" != "true" ]; then
    echo ""
    echo "⏳ 等待数据库启动..."
    sleep 5
fi

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
