# 部署指南

本指南说明如何使用 GitHub Actions 为 Daer Novel 设置自动部署。

> [!NOTE]
> 针对国内服务器网络环境，我们配置了 `docker.1ms.run` 代理来加速镜像拉取。
> 部署流程会自动构建镜像推送到 GitHub，然后服务器通过代理地址拉取。

## 前置条件

1.  **服务器**: 一台具有公网 IP 的 Linux 服务器（CentOS 7/8/9 等）。
2.  **域名** (可选): 指向您服务器 IP 的域名。
3.  **目录**: 本指南默认部署目录为 `~/www/wwwroot/novel.daerai.com/`。

## 1. 服务器配置

通过 SSH 登录您的服务器并安装 Docker 和 Docker Compose：

```bash
# 更新软件包
sudo yum update -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker 并设置开机自启
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户添加到 docker 组
sudo usermod -aG docker $USER
# 应用组更改
newgrp docker

# 创建项目目录
mkdir -p ~/www/wwwroot/novel.daerai.com/
```

### 配置 Docker 镜像加速（推荐）
为了能顺利拉取 `postgres` 和 `redis` 等公共基础镜像，建议配置国内镜像源。
(业务镜像已配置使用 `docker.1ms.run` 代理，无需在此配置)

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com"
  ]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

## 2. GitHub Secrets 配置

进入您的 GitHub 仓库 -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**。

### 自动变量 (无需配置)
以下变量由 GitHub Actions 自动提供，**您不需要手动设置**：
*   `github.repository`: 仓库名称 (如 `yuwangi/daer-novel`)
*   `github.actor`: 触发构建的用户名
*   `secrets.GITHUB_TOKEN`: 自动生成的权限令牌 (用于登录 GHCR)
*   `env.REGISTRY`: 在 yml 中定义为 `ghcr.io` (GitHub 官方镜像库)

### 手动配置 (必须设置)
添加以下密钥用于服务器连接：

| 密钥名称 | 描述 |
| :--- | :--- |
| `SERVER_HOST` | 服务器公网 IP |
| `SERVER_USER` | SSH 用户名 (如 `root`) |
| `SERVER_PASSWORD` | SSH 密码 |
| `SERVER_PORT` | SSH 端口 (可选，默认 22) |

## 3. 环境变量配置

在服务器上创建 `.env` 文件：

```bash
cd ~/www/wwwroot/novel.daerai.com/
vi .env
```

粘贴配置：

```env
POSTGRES_PASSWORD=your_secure_db_password
OPENAI_API_KEY=sk-....
ANTHROPIC_API_KEY=sk-....
DEEPSEEK_API_KEY=sk-....
```

## 4. 部署流程

1.  将代码推送到 `main` 分支。
2.  GitHub Actions 会自动构建镜像并推送到 GHCR。
3.  服务器会自动拉取新镜像（通过 `docker.1ms.run` 代理）并重启服务。
