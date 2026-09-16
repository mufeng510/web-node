# Web Note

> **Browser-first, Self-hosted, Markdown-first, Obsidian-compatible, AI-native personal knowledge base**

[中文版](./README.zh-CN.md) | [Website](https://web-note.github.io) | [Documentation](https://web-note.github.io/docs) | [Docker](https://github.com/web-note/web-note/pkgs/container/web-note)

---

## ✨ Features

- 🌐 **Browser-first** — No desktop client needed, works in any modern browser
- 🏠 **Self-hosted** — Deploy on your NAS, server, or local machine via Docker
- 📝 **Markdown-first** — Local `.md` files as source of truth, no vendor lock-in
- 🔗 **Obsidian-compatible** — WikiLinks, callouts, frontmatter, Mermaid, math, and more
- 🤖 **AI-native** — Built-in chat, agent with tools, MCP server for external AI
- 🔒 **Git versioning** — Auto-backup, history, diff, restore with conflict safety
- 📱 **Mobile responsive** — Touch-optimized UI for phones and tablets
- 🎨 **Themes** — Light, dark, and system-adaptive with customizable fonts
- ⚡ **Real-time** — Live file watching, collaborative editing ready
- 🔐 **Secure** — Argon2id passwords, HttpOnly cookies, encrypted secrets, audit logs

---

## 🚀 Quick Start

### Docker (Recommended)

```bash
# Create directories
mkdir -p /volume1/docker/webnote/data /volume1/docker/webnote/app-data

# Create .env file
cat > /volume1/docker/webnote/.env << EOF
MASTER_ENCRYPTION_KEY=$(openssl rand -base64 32)
TZ=Asia/Shanghai
EOF

# Run with Docker Compose
cd /volume1/docker/webnote
curl -O https://raw.githubusercontent.com/web-note/web-note/main/docker-compose.yml
docker-compose up -d
```

Open http://localhost:8080 and follow the setup wizard.

### FNOS (Friendly NAS OS)

1. Open FNOS App Store
2. Search for "Web Note"
3. Click Install
4. Configure volumes and environment variables
5. Access via FNOS dashboard

---

## 📦 Deployment

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

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Single Docker Container                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │  Hono   │ │  Tiptap │ │ SQLite  │ │  Chokidar│            │
│  │  API    │ │ Editor  │ │  (WAL)  │ │ Watcher │            │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │
│       │           │           │           │                  │
│  ┌────▼───────────▼───────────▼───────────▼────┐             │
│  │          Unified Tool Service                │             │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐ │             │
│  │  │ Files  │ │ Search │ │  Git   │ │  AI   │ │             │
│  │  └────────┘ └────────┘ └────────┘ └───────┘ │             │
│  └────────────────────────────────────────────┘             │
│       │           │           │           │                  │
│  ┌────▼───────────▼───────────▼───────────▼────┐             │
│  │         Permission Layer (Allow/Ask/Deny)     │             │
│  └────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action → API → Permission Check → Tool Service → File System / Git / AI
                                    ↓
                              SQLite (Metadata, Index, Audit)
```

---

## 📁 Project Structure

```
web-note/
├── src/
│   ├── backend/          # Hono API server
│   │   ├── modules/      # Feature modules
│   │   ├── db/           # Drizzle ORM + SQLite
│   │   ├── middleware/   # Auth, CSRF, Audit, Error
│   │   └── utils/        # Crypto, Path, Validation
│   ├── frontend/         # React 19 + Vite
│   │   ├── components/   # UI components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # React hooks
│   │   ├── services/     # API client
│   │   └── styles/       # Tailwind + CSS
│   └── shared/           # Shared types
├── tests/                # Unit, Integration, E2E
├── scripts/              # Build, Dev, Migration scripts
├── docker-compose.yml    # Local development
├── docker-compose.fnos.yml # FNOS deployment
├── Dockerfile            # Multi-arch build
└── openapi.json          # API specification
```

---

## 🛠️ Development

### Prerequisites

- Bun 1.1+
- Docker (for containerized development)
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/web-note/web-note.git
cd web-note

# Install dependencies
bun install

# Run database migrations
bun run db:migrate

# Start development server
bun run dev
```

### Available Scripts

```bash
bun run dev           # Start dev server with hot reload
bun run build         # Build for production
bun run start         # Start production server
bun run lint          # Run Biome linter
bun run lint:fix      # Auto-fix lint issues
bun run format        # Format code with Biome
bun run typecheck     # TypeScript type checking
bun run test          # Run unit tests
bun run test:e2e      # Run Playwright E2E tests
bun run db:migrate    # Run database migrations
bun run db:push       # Push schema changes
bun run db:studio     # Open Drizzle Studio
bun run openapi:generate  # Generate OpenAPI spec
bun run types:generate    # Generate TypeScript types
bun run fnos:package      # Create FNOS package
```

---

## 🧪 Testing

```bash
# Unit tests
bun run test

# E2E tests (requires running server)
bun run test:e2e

# E2E with UI
bun run test:e2e:ui
```

### Test Coverage

- Unit: Core utilities, auth, path handling, crypto
- Integration: API endpoints, database operations, Git
- E2E: Auth flow, library management, editor, AI chat, agent, mobile

---

## 📚 Documentation

- [User Guide](https://web-note.github.io/docs/user-guide)
- [API Reference](https://web-note.github.io/docs/api)
- [Architecture](https://web-note.github.io/docs/architecture)
- [Deployment](https://web-note.github.io/docs/deployment)
- [Configuration](https://web-note.github.io/docs/configuration)
- [AI & Agent](https://web-note.github.io/docs/ai)
- [MCP Integration](https://web-note.github.io/docs/mcp)
- [Git Workflow](https://web-note.github.io/docs/git)
- [Security](https://web-note.github.io/docs/security)
- [FAQ](https://web-note.github.io/docs/faq)

---

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) first.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with tests
4. Run lint, typecheck, and tests: `bun run lint && bun run typecheck && bun run test`
5. Commit with conventional commits: `git commit -m "feat: add amazing feature"`
6. Push and open a Pull Request

### Code Style

- Biome for linting and formatting
- TypeScript strict mode
- Conventional Commits for commit messages
- Drizzle ORM for database operations
- Zod for validation

---

## 🔒 Security

- **Passwords**: Argon2id with memory-hard parameters
- **Sessions**: HttpOnly, Secure, SameSite=Strict cookies
- **CSRF**: Double-submit cookie pattern
- **Secrets**: AES-GCM encryption with master key from environment
- **Path Safety**: Absolute path validation, symlink escape prevention
- **Audit Logs**: All security-relevant actions logged
- **AI Safety**: Prompt injection prevention, tool permission layers

### Reporting Vulnerabilities

Please report security issues to security@web-note.dev (GPG key available on website).

---

## 📄 License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

---

## 🙏 Acknowledgments

- [Obsidian](https://obsidian.md/) for Markdown compatibility inspiration
- [Tiptap](https://tiptap.dev/) for the excellent editor framework
- [Hono](https://hono.dev/) for the fast, lightweight web framework
- [Drizzle ORM](https://orm.drizzle.team/) for type-safe database access
- [Bun](https://bun.sh/) for the fast JavaScript runtime
- [Tailwind CSS](https://tailwindcss.com/) for utility-first styling

---

## 📞 Support

- [GitHub Issues](https://github.com/web-note/web-note/issues)
- [Discussions](https://github.com/web-note/web-note/discussions)
- [Discord](https://discord.gg/web-note)
- [Email](mailto:support@web-note.dev)