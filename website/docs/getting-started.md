---
sidebar_position: 1
title: Getting Started
description: Quick start guide for Web Note
---

# Getting Started

Welcome to Web Note! This guide will help you set up and start using your personal knowledge base.

## Prerequisites

- Docker and Docker Compose installed
- A machine with at least 1GB RAM (2GB+ recommended)
- Port 8080 available

## Quick Start with Docker Compose

### 1. Create Data Directories

```bash
mkdir -p /volume1/docker/webnote/data /volume1/docker/webnote/app-data
```

### 2. Create Environment File

```bash
cat > /volume1/docker/webnote/.env << EOF
MASTER_ENCRYPTION_KEY=$(openssl rand -base64 32)
TZ=Asia/Shanghai
EOF
```

### 3. Download Docker Compose

```bash
cd /volume1/docker/webnote
curl -O https://raw.githubusercontent.com/web-note/web-note/main/docker-compose.yml
```

### 4. Start Web Note

```bash
docker-compose up -d
```

### 5. Access Web Note

Open your browser and navigate to `http://your-server-ip:8080`

## First Run: Setup Wizard

On first access, you'll see the setup wizard:

1. **Create Admin Account** - Enter your email and a strong password (min 8 characters)
2. **Complete Setup** - Click "Create Admin Account"
3. **Sign In** - You'll be redirected to the dashboard

## Creating Your First Library

A **Library** is a folder on your filesystem that Web Note manages:

1. Click **"+ New Library"** in the top bar
2. Enter a **Name** (e.g., "My Notes")
3. Enter a **Path** relative to `/data` (e.g., `my-notes`)
4. Click **Create**

Web Note will:
- Create the folder at `/data/my-notes`
- Initialize a `.webnote` config folder
- Start indexing files for search and AI

## Basic Usage

### Creating Notes

1. Select your library from the dropdown
2. Click **"New Note"** or press `Ctrl/Cmd + N`
3. Start writing in Markdown

### Editor Modes

- **WYSIWYG** - Visual editing (default)
- **Source** - Raw Markdown with syntax highlighting
- **Reading** - Clean reading view

Switch modes using the toolbar or `Ctrl/Cmd + Shift + M`.

### WikiLinks

Create links between notes using Obsidian-style syntax:

```markdown
[[Note Name]]
[[Note Name|Display Text]]
[[Note Name#Heading]]
[[Note Name#^block-id]]
```

Type `[[` to trigger autocomplete.

### Frontmatter/Properties

Add metadata to notes:

```markdown
---
title: My Note
tags: [project, important]
date: 2024-01-15
status: draft
---

Content here...
```

Use the Properties panel (right sidebar) for visual editing.

## Next Steps

- [Configuration](/docs/guides/configuration) - Customize Web Note
- [Libraries](/docs/guides/libraries) - Manage multiple libraries
- [Editor](/docs/guides/editor) - Master the editor
- [AI Chat](/docs/guides/ai-chat) - Use AI assistance
- [Git Integration](/docs/guides/git) - Version control your notes

## Troubleshooting

### Port Already in Use

Change the port in `docker-compose.yml`:

```yaml
ports:
  - "8081:8080"  # Use port 8081 on host
```

### Permission Errors

Ensure Docker has read/write access to your data directories:

```bash
sudo chown -R 1000:1000 /volume1/docker/webnote/data /volume1/docker/webnote/app-data
```

### Health Check Fails

Check logs:

```bash
docker logs webnote
```

Common issues:
- `MASTER_ENCRYPTION_KEY` not set or too short (min 32 chars)
- Database migration pending (run `docker exec webnote bun run db:migrate`)
- Data directory not writable

## Support

- [GitHub Issues](https://github.com/web-note/web-note/issues)
- [Discord](https://discord.gg/web-note)
- [Documentation](https://web-note.github.io/docs)