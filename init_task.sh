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

# 创建目录结构
echo "正在为题目 '$TASK_ID' 创建目录结构并复制源码..."

mkdir -p "$TASK_ID/environment/repo"

# 创建 instruction.md
cat <<EOF > "$TASK_ID/instruction.md"
# 任务描述
(请在此处输入用户输入的任务 Prompt)
EOF

# 创建 Dockerfile
cat <<EOF > "$TASK_ID/environment/Dockerfile"
# 基础镜像（自定义，可选择一个最合适当前项目的base image）
FROM ubuntu:22.04

# 设置工作目录 (必须为 /app)
WORKDIR /app

# 把宿主机当前目录下 repo 文件夹内的“所有内容”复制到容器的 /app 目录下
COPY repo/ ./

# 安装必要环境 等操作
RUN apt-get update && apt-get install -y --no-install-recommends \\
    tmux \\
    git \\
    curl \\
    python3 \\
    python3-pip \\
    && rm -rf /var/lib/apt/lists/*

# (可选) 如果有特定的构建命令，请添加在此处
# RUN ...
EOF

# 复制当前目录内容到 repo (排除 node_modules, 当前及以往的任务文件夹, 脚本本身和 .git)
# 我们排除所有包含 environment/ 目录的文件夹，因为它们通常是其他任务文件夹
rsync -a --exclude="node_modules" \
         --exclude=".git" \
         --exclude="$TASK_ID" \
         --exclude="init_task.sh" \
         --exclude="test*" \
         --exclude="target" \
         --exclude="dist" \
         --exclude="build" \
         ./ "$TASK_ID/environment/repo/"

# 初始化 git 仓库并提交
(
    cd "$TASK_ID/environment/repo" || exit
    git init
    git add .
    git commit -m "initial commit: project snapshot"
)

echo "完成！目录结构已创建在: $TASK_ID/"
echo "结构如下:"
ls -R "$TASK_ID"
