## 交付示例&文件说明

[dog_fooding_demo.zip]()

```dockerfile
dog_fooding_demo/
├── instruction.md          # 用户输入的任务 Prompt
└── environment/            # 运行环境配置目录
    ├── Dockerfile          # 环境主入口，定义容器构建方式
    └── repo/               # [optional] 被测仓库的完整源码快照
```

<span style="color: inherit; background-color: rgb(255,233,40)">PS: 交付的时候要注意Dockerfile能够正常docker build要完整且能够被正常解析。</span>

### 交付要求

1. Mac 系统则需要按照 Linux dockerfile 的形式写。

2. 压缩包名需要以表格中的【题目 id】命名（**严格遵循**）。

3. 文件必须严格遵循示例文件给的结构（不要直接将代码仓源码放在第一层文件夹里）：

   ```dockerfile
   题目id/
   ├── instruction.md          # 用户输入的任务 Prompt
   └── environment/            # 运行环境配置目录
       ├── Dockerfile          # 环境主入口，定义容器构建方式
       └── repo/               # 可选：被测仓库的完整源码快照，如果是0到1的生成题目可留空
   ```

   - 对于repo：
     1. 需要本身是有git init的（例如对于0-1可以是一个git init的空目录，对于非0-1的任务，可以是位于一个初始的commit）。

     2. 如果dockerfile所需要引入的依赖项，过于复杂，必须要通过引用原始的工程目录的话，那需要在dockerfile中build完之后删除多余的一些文件，最终要求剩下的目录是模型实际做题时候的初始状态。

4. **确保 git init**，即使是空的，也要初始化一下。

5. 确保仓库现场是 agent 需要解决问题的现场，即模型处理前的代码（如果是01不依赖其他配置的可留空）。如果不是请提供对应的 base_commit

6. **workdir必须：/app**

# 附录

## Linux dockerfile

```dockerfile
# 基础镜像（自定义，可选择一个最合适当前项目的base image）
FROM ubuntu:22.04

# 设置工作目录
WORKDIR /app

# 把宿主机当前目录下 xxx 仓库文件夹内的“所有内容”复制到容器的 /app 目录下
COPY xxx/ ./

# (可选) 安装必要环境 等操作
RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux \
    git \
    curl \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/* # 使用 pip3 安装 Python 依赖
RUN pip3 install --no-cache-dir pandas scipy numpy scikit-learn
```
