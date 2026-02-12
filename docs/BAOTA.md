# 宝塔面板 (Baota Panel) 配置指南

本指南说明如何在宝塔面板中配置 Nginx 反向代理，以便通过域名访问您的 Daer Novel 应用。

## 前置条件

1.  **项目已部署**：确保 GitHub Actions 部署流程已成功执行，Docker 容器正在运行。
2.  **端口检查**：
    *   前端容器端口：`3000` (Docker 内部)
    *   后端容器端口：`8002` (Docker 内部)
3.  **域名解析**：确保您的域名已解析到服务器 IP。

## 步骤 1：添加站点

1.  登录宝塔面板。
2.  点击左侧菜单 **网站** -> **添加站点**。
3.  **域名**：填写您的域名 (例如 `novel.daerai.com`)。
4.  **备注**：随意填写 (例如 `Daer Novel`)。
5.  **根目录**：保持默认即可 (反向代理不依赖此目录)。
6.  **PHP 版本**：选择 `纯静态`。
7.  点击 **提交**。

## 步骤 2：配置 SSL (推荐)

1.  在网站列表中找到刚才添加的站点，点击 **设置**。
2.  点击左侧 **SSL**。
3.  选择 **Let's Encrypt** 或上传您自己的证书。
4.  申请并开启 **强制 HTTPS**。

## 步骤 3：配置反向代理

我们需要配置两个代理规则：一个用于前端页面 (端口 3000)，一个用于后端 API (端口 8002)。

### 1. 配置前端代理 (根路径 /)

1.  在站点设置窗口，点击左侧 **反向代理**。
2.  点击 **添加反向代理**。
3.  **代理名称**：`Frontend`
4.  **目标 URL**：`http://127.0.0.1:3000`
5.  **发送域名**：`$host`
6.  点击 **提交**。

### 2. 配置后端 API 代理 (/api)

由于宝塔可视化界面不太好配置复杂的路径代理，建议直接修改配置文件。

1.  在站点设置窗口，点击左侧 **配置文件**。
2.  在 `server` 块中，找到刚才添加的 `location /` 配置块下方，添加以下内容：

```nginx
    # 后端 API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8002/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 支持 WebSocket (Socket.IO)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Socket.IO 代理
    location /socket.io/ {
        proxy_pass http://127.0.0.1:8002/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
```

3.  点击 **保存**。

## 步骤 4：验证

打开浏览器访问您的域名 (例如 `https://novel.daerai.com`)，应该能看到 Daer Novel 的登录页面。

### 常见问题

*   **502 Bad Gateway**: 检查 Docker 容器是否正在运行 (`docker ps`)，以及端口 3000 和 8002 是否已监听。
*   **WebSocket 连接失败**: 确保 `/socket.io/` 的配置块已正确添加，并且支持 `Upgrade` 头。
*   **上传文件失败**: Nginx 默认限制上传大小，建议在配置文件 `http` 或 `server` 块中添加 `client_max_body_size 50m;`。
