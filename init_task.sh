#!/bin/bash

# 获取题目 ID
if [ -z "$1" ]; then
    read -p "请输入题目 ID: " TASK_ID
else
    TASK_ID=$1
fi

if [ -z "$TASK_ID" ]; then
    echo "错误: 题目 ID 不能为空。"
    exit 1
fi

# ==========================================
# 项目类型及依赖检测
# ==========================================
BASE_IMAGE="ubuntu:22.04"
INSTALL_NODE=""
INSTALL_PNPM=""
DB_PACKAGES="git curl tmux build-essential ca-certificates"
SETUP_COMMANDS=""
POST_COPY_COMMANDS=""
HAS_POSTGRES=false
HAS_REDIS=false

# 1. 检测 Node.js
if [ -f "package.json" ]; then
    echo "检测到 Node.js 项目..."
    INSTALL_NODE="RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs"
    if [ -f "pnpm-lock.yaml" ]; then
        INSTALL_PNPM="RUN npm install -g pnpm && pnpm config set registry https://registry.npmmirror.com"
        POST_COPY_COMMANDS="$POST_COPY_COMMANDS\nRUN pnpm install"
    elif [ -f "yarn.lock" ]; then
        INSTALL_PNPM="RUN npm install -g yarn && yarn config set registry https://registry.npmmirror.com"
        POST_COPY_COMMANDS="$POST_COPY_COMMANDS\nRUN yarn install"
    else
        INSTALL_PNPM="RUN npm config set registry https://registry.npmmirror.com"
        POST_COPY_COMMANDS="$POST_COPY_COMMANDS\nRUN npm install"
    fi
fi

# 2. 检测数据库需求
if [ -f "docker-compose.yml" ]; then
    if grep -qE "postgres|pgvector" docker-compose.yml; then
        HAS_POSTGRES=true
        DB_PACKAGES="$DB_PACKAGES postgresql postgresql-contrib"
        if grep -q "pgvector" docker-compose.yml; then
            DB_PACKAGES="$DB_PACKAGES postgresql-server-dev-all"
            SETUP_COMMANDS="$SETUP_COMMANDS\n# 安装 pgvector\nRUN git clone --branch v0.6.0 https://github.com/pgvector/pgvector.git /tmp/pgvector && cd /tmp/pgvector && make clean && make && make install"
        fi
    fi
    if grep -q "redis" docker-compose.yml; then
        HAS_REDIS=true
        DB_PACKAGES="$DB_PACKAGES redis-server"
    fi
fi

# 创建目录结构
echo "正在为题目 '$TASK_ID' 创建目录结构并复制源码..."
mkdir -p "$TASK_ID/environment/repo"

# 创建 instruction.md
cat <<EOF > "$TASK_ID/instruction.md"
# 任务描述
(请在此处输入用户输入的任务 Prompt)
EOF

# 生成一键启动脚本 start_task.sh
START_SCRIPT_PATH="$TASK_ID/environment/repo/start_task.sh"
cat <<EOF > "$START_SCRIPT_PATH"
#!/bin/bash
set -e

echo "--- 正在启动系统服务 ---"
$( [ "$HAS_POSTGRES" = true ] && echo "service postgresql start" )
$( [ "$HAS_REDIS" = true ] && echo "service redis-server start" )

$( [ "$HAS_POSTGRES" = true ] && echo 'echo "等待数据库就绪..."
until pg_isready; do
  sleep 2
done' )

echo "--- 正在启动项目应用 ---"
if [ -f "package.json" ]; then
    # 尝试运行迁移 (如果存在 backend 过滤器)
    if pnpm --filter backend run | grep -q "migration:run"; then
        echo "发现迁移脚本，正在运行..."
        pnpm --filter backend migration:run || echo "警告: 迁移阶段出现问题"
    fi

    # 启动应用
    echo "并发启动前端和后端..."
    pnpm --filter backend dev &
    pnpm --filter frontend dev &
fi

# 保持前台运行
wait
EOF
chmod +x "$START_SCRIPT_PATH"

# 创建 Dockerfile
cat <<EOF > "$TASK_ID/environment/Dockerfile"
# 基础镜像
FROM $BASE_IMAGE

ENV DEBIAN_FRONTEND=noninteractive

# 加速: 使用国内 Apt 源 (清华大学镜像)
RUN sed -i 's/ports.ubuntu.com/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list && \\
    sed -i 's/archive.ubuntu.com/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list && \\
    sed -i 's/security.ubuntu.com/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list

# 设置工作目录
WORKDIR /app

# 1. 安装基础工具及系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \\
    $DB_PACKAGES \\
    && rm -rf /var/lib/apt/lists/*

# 2. 安装 Node.js 环境
$INSTALL_NODE
$INSTALL_PNPM

# 3. 项目特定设置
$(echo -e "$SETUP_COMMANDS")

# 4. 复制源码
COPY repo/ ./
RUN chmod +x start_task.sh

# 5. 预安装项目依赖
$(echo -e "$POST_COPY_COMMANDS")

# 一键启动指令
CMD ["/bin/bash", "start_task.sh"]
EOF

# 复制源码
rsync -a --exclude="node_modules" \
         --exclude=".git" \
         --exclude="$TASK_ID" \
         --exclude="init_task.sh" \
         --exclude="test*" \
         --exclude="dogfooding-*" \
         --exclude="target" \
         --exclude="dist" \
         --exclude="build" \
         ./ "$TASK_ID/environment/repo/"

# 初始化 git
(
    cd "$TASK_ID/environment/repo" || exit
    git init
    git add .
    git commit -m "initial commit: one-click project with optimized build"
)

echo "=========================================================="
echo "完成！项目环境已创建在: $TASK_ID/"
echo "已集成清华大学 Apt 源及 npmmirror 加速，构建速度应显著提升。"
echo "您可以运行以下命令一键构建并启动项目："
echo "----------------------------------------------------------"
echo "cd $TASK_ID/environment && docker build -t $TASK_ID . && docker run -it -p 8001:8001 -p 8002:8002 $TASK_ID"
echo "----------------------------------------------------------"
