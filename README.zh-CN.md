# Web Note

> **浏览器优先、自托管、Markdown 优先、Obsidian 兼容、AI 原生的个人知识库**

[English](./README.md) | [官网](https://web-note.github.io) | [文档](https://web-note.github.io/docs) | [Docker](https://github.com/web-note/web-note/pkgs/container/web-note)

---

## ✨ 特性

- 🌐 **浏览器优先** — 无需桌面客户端，任何现代浏览器即可访问
- 🏠 **自托管** — 通过 Docker 部署在 NAS、服务器或本地机器
- 📝 **Markdown 优先** — 本地 `.md` 文件作为真实数据源，无厂商锁定
- 🔗 **Obsidian 兼容** — WikiLinks、Callouts、Frontmatter、Mermaid、数学公式等
- 🤖 **AI 原生** — 内置聊天、拥有工具的 Agent、供外部 AI 使用的 MCP 服务器
- 🔒 **Git 版本控制** — 自动备份、历史记录、差异对比、带冲突保护的恢复
- 📱 **移动端响应式** — 针对手机和平板优化的触控友好界面
- 🎨 **主题** — 浅色、深色、跟随系统，支持自定义字体
- ⚡ **实时** — 实时文件监听，为协作编辑做好准备
- 🔐 **安全** — Argon2id 密码、HttpOnly Cookie、加密密钥、审计日志

---

## 🚀 快速开始

### Docker（推荐）

```bash
# 创建目录
mkdir -p /volume1/docker/webnote/data /volume1/docker/webnote/app-data

# 创建 .env 文件
cat > /volume1/docker/webnote/.env << EOF
MASTER_ENCRYPTION_KEY=$(openssl rand -base64 32)
TZ=Asia/Shanghai
EOF

# 使用 Docker Compose 运行
cd /volume1/docker/webnote
curl -O https://raw.githubusercontent.com/web-note/web-note/main/docker-compose.yml
docker-compose up -d
```

在浏览器打开 http://localhost:8080 并按照设置向导操作。

### FNOS (群晖/威联通等 NAS 系统)

1. 打开 FNOS 应用商店
2. 搜索 "Web Note"
4. 点击安装
5. 配置卷和环境变量
6. 通过 FNOS 仪表板访问

---

## 📦 部署

### Docker Compose

```yaml
version: '3.8'
services:
  webnote:
    image: ghcr.io/web-note/web-note:latest
    container_name: webnote
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
      - ./app-data:/app-data
    environment:
      - NODE_ENV=production
      - MASTER_ENCRYPTION_KEY=your-32-char-secret
      - TZ=UTC
    restart: unless-stopped
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webnote
spec:
  replicas: 1
  selector:
    matchLabels:
      app: webnote
  template:
    metadata:
      labels:
        app: webnote
    spec:
      containers:
      - name: webnote
        image: ghcr.io/web-note/web-note:latest
        ports:
        - containerPort: 8080
        env:
        - name: MASTER_ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: webnote-secrets
              key: master-key
        volumeMounts:
        - name: data
          mountPath: /data
        - name: app-data
          mountPath: /app-data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: webnote-data
      - name: app-data
        persistentVolumeClaim:
          claimName: webnote-app-data
```

---

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    单 Docker 容器                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │  Hono   │ │  Tiptap │ │ SQLite  │ │  Chokidar│            │
│  │  API    │ │ Editor  │ │  (WAL)  │ │ Watcher │            │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │
│       │           │           │           │                  │
│  ┌────▼───────────▼───────────▼───────────▼────┐             │
│  │          统一工具服务                          │             │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐ │             │
│  │  │ 文件   │ │ 搜索   │ │  Git   │ │  AI   │ │             │
│  │  └────────┘ └────────┘ └────────┘ └───────┘ │             │
│  └────────────────────────────────────────────┘             │
│       │           │           │           │                  │
│  ┌────▼───────────▼───────────▼───────────▼────┐             │
│  │         权限层 (允许/询问/拒绝)                │             │
│  └────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户操作 → API → 权限检查 → 工具服务 → 文件系统 / Git / AI
                                    ↓
                              SQLite (元数据、索引、审计)
```

---

## 📁 项目结构

```
web-note/
├── src/
│   ├── backend/          # Hono API 服务器
│   │   ├── modules/      # 功能模块
│   │   ├── db/           # Drizzle ORM + SQLite
│   │   ├── middleware/   # 认证、CSRF、审计、错误处理
│   │   └── utils/        # 加密、路径、验证
│   ├── frontend/         # React 19 + Vite
│   │   ├── components/   # UI 组件
│   │   ├── pages/        # 页面组件
│   │   ├── hooks/        # React Hooks
│   │   ├── services/     # API 客户端
│   │   └── styles/       # Tailwind + CSS
│   └── shared/           # 共享类型
├── tests/                # 单元、集成、E2E 测试
├── scripts/              # 构建、开发、迁移脚本
├── docker-compose.yml    # 本地开发
├── docker-compose.fnos.yml # FNOS 部署
├── Dockerfile            # 多架构构建
└── openapi.json          # API 规范
```

---

## 🛠️ 开发

### 前置要求

- Bun 1.1+
- Docker（用于容器化开发）
- Git

### 设置

```bash
# 克隆仓库
git clone https://github.com/web-note/web-note.git
cd web-note

# 安装依赖
bun install

# 运行数据库迁移
bun run db:migrate

# 启动开发服务器
bun run dev
```

### 可用脚本

```bash
bun run dev           # 启动带热重载的开发服务器
bun run build         # 构建生产版本
bun run start         # 启动生产服务器
bun run lint          # 运行 Biome 代码检查
bun run lint:fix      # 自动修复代码检查问题
bun run format        # 使用 Biome 格式化代码
bun run typecheck     # TypeScript 类型检查
bun run test          # 运行单元测试
bun run test:e2e      # 运行 Playwright E2E 测试
bun run db:migrate    # 运行数据库迁移
bun run db:push       # 推送 Schema 变更
bun run db:studio     # 打开 Drizzle Studio
bun run openapi:generate  # 生成 OpenAPI 规范
bun run types:generate    # 生成 TypeScript 类型
bun run fnos:package      # 创建 FNOS 包
```

---

## 🧪 测试

```bash
# 单元测试
bun run test

# E2E 测试（需要运行中的服务器）
bun run test:e2e

# 带 UI 的 E2E 测试
bun run test:e2e:ui
```

### 测试覆盖

- 单元：核心工具、认证、路径处理、加密
- 集成：API 端点、数据库操作、Git
- E2E：认证流程、库管理、编辑器、AI 聊天、Agent、移动端

---

## 📚 文档

- [用户指南](https://web-note.github.io/docs/user-guide)
- [API 参考](https://web-note.github.io/docs/api)
- [架构](https://web-note.github.io/docs/architecture)
- [部署](https://web-note.github.io/docs/deployment)
- [配置](https://web-note.github.io/docs/configuration)
- [AI 与 Agent](https://web-note.github.io/docs/ai)
- [MCP 集成](https://web-note.github.io/docs/mcp)
- [Git 工作流](https://web-note.github.io/docs/git)
- [安全](https://web-note.github.io/docs/security)
- [常见问题](https://web-note.github.io/docs/faq)

---

## 🤝 贡献

欢迎贡献！请先阅读我们的 [贡献指南](CONTRIBUTING.md)。

### 开发工作流

1. Fork 仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 进行更改并编写测试
4. 运行代码检查、类型检查和测试：`bun run lint && bun run typecheck && bun run test`
5. 使用规范化提交：`git commit -m "feat: add amazing feature"`
6. 推送并创建 Pull Request

### 代码风格

- Biome 用于代码检查和格式化
- TypeScript 严格模式
- 规范化提交信息
- Drizzle ORM 用于数据库操作
- Zod 用于验证

---

## 🔒 安全

- **密码**：Argon2id 配合内存硬化参数
- **会话**：HttpOnly、Secure、SameSite=Strict Cookie
- **CSRF**：双重提交 Cookie 模式
- **密钥**：AES-GCM 加密，主密钥来自环境变量
- **路径安全**：绝对路径验证、符号链接逃逸防护
- **审计日志**：所有安全相关操作记录日志
- **AI 安全**：提示注入防护、工具权限层

### 报告漏洞

请将安全问题报告至 security@web-note.dev（网站上提供 GPG 公钥）。

---

## 📄 许可证

GNU 通用公共许可证 v3.0 — 详见 [LICENSE](LICENSE)。

本程序是自由软件：您可以根据自由软件基金会发布的 GNU 通用公共许可证的条款重新分发和/或修改它，许可证版本为版本 3，或（根据您的选择）任何更高版本。

---

## 🙏 致谢

- [Obsidian](https://obsidian.md/) 提供 Markdown 兼容性灵感
- [Tiptap](https://tiptap.dev/) 提供优秀的编辑器框架
- [Hono](https://hono.dev/) 提供快速轻量的 Web 框架
- [Drizzle ORM](https://orm.drizzle.team/) 提供类型安全的数据库访问
- [Bun](https://bun.sh/) 提供快速 JavaScript 运行时
- [Tailwind CSS](https://tailwindcss.com/) 提供实用优先的样式

---

## 📞 支持

- [GitHub Issues](https://github.com/web-note/web-note/issues)
- [Discussions](https://github.com/web-note/web-note/discussions)
- [Discord](https://discord.gg/web-note)
- [邮件](mailto:support@web-note.dev)