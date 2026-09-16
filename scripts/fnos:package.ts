#!/usr/bin/env bun

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');

async function main() {
  console.log('📦 Creating FNOS package...');

  if (!existsSync(DIST)) {
    mkdirSync(DIST, { recursive: true });
  }

  const fnosDir = resolve(DIST, 'fnos');
  if (existsSync(fnosDir)) {
    // Clean up
  }
  mkdirSync(fnosDir, { recursive: true });

  const manifest = {
    name: 'Web Note',
    version: '0.1.0',
    description:
      'Browser-first, Self-hosted, Markdown-first, Obsidian-compatible, AI-native personal knowledge base',
    author: 'Web Note Team',
    license: 'GPL-3.0',
    repository: 'https://github.com/web-note/web-note',
    homepage: 'https://web-note.github.io',
    icon: 'icon.png',
    categories: ['productivity', 'notes', 'ai'],
    keywords: ['markdown', 'notes', 'obsidian', 'ai', 'knowledge-base', 'self-hosted'],
    docker: {
      image: 'ghcr.io/web-note/web-note:latest',
      ports: [{ containerPort: 8080, hostPort: 8080, protocol: 'tcp' }],
      volumes: [
        {
          containerPath: '/data',
          hostPath: '/volume1/docker/webnote/data',
          description: 'Library data storage',
        },
        {
          containerPath: '/app-data',
          hostPath: '/volume1/docker/webnote/app-data',
          description: 'Application data storage',
        },
      ],
      environment: [
        {
          name: 'MASTER_ENCRYPTION_KEY',
          description: 'Master encryption key (32+ chars)',
          required: true,
          type: 'password',
        },
        {
          name: 'NODE_ENV',
          description: 'Environment',
          required: false,
          default: 'production',
          type: 'select',
          options: ['development', 'production'],
        },
        { name: 'TZ', description: 'Timezone', required: false, default: 'UTC', type: 'string' },
        { name: 'PORT', description: 'Port', required: false, default: '8080', type: 'number' },
      ],
      healthCheck: {
        path: '/health',
        interval: 30,
        timeout: 10,
        retries: 3,
        startPeriod: 10,
      },
    },
    fnos: {
      minVersion: '0.7.0',
      installPath: '/volume1/docker/webnote',
      dataPath: '/volume1/docker/webnote/data',
      configPath: '/volume1/docker/webnote/app-data',
      autoStart: true,
      restartPolicy: 'unless-stopped',
    },
  };

  writeFileSync(resolve(fnosDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const dockerCompose = `version: '3.8'

services:
  webnote:
    image: ghcr.io/web-note/web-note:latest
    container_name: webnote
    ports:
      - "8080:8080"
    volumes:
      - /volume1/docker/webnote/data:/data
      - /volume1/docker/webnote/app-data:/app-data
    environment:
      - NODE_ENV=production
      - PORT=8080
      - DATA_ROOT=/data
      - APP_DATA_ROOT=/app-data
      - MASTER_ENCRYPTION_KEY=\${MASTER_ENCRYPTION_KEY}
      - DATABASE_URL=file:/app-data/webnote.db
      - TZ=\${TZ:-Asia/Shanghai}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    labels:
      - "fnos.name=Web Note"
      - "fnos.description=Browser-first, Self-hosted, Markdown-first, Obsidian-compatible, AI-native personal knowledge base"
      - "fnos.category=productivity"
      - "fnos.version=0.1.0"
      - "fnos.port=8080"
      - "fnos.volume.data=/data"
      - "fnos.volume.app-data=/app-data"
`;

  writeFileSync(resolve(fnosDir, 'docker-compose.yml'), dockerCompose);

  const readme = `# Web Note - FNOS Package

## Installation

1. Copy this folder to your FNOS device: \`/volume1/docker/webnote/\`
2. Create \`.env\` file with required environment variables:
   \`\`\`
   MASTER_ENCRYPTION_KEY=your-32-char-minimum-secret-key
   TZ=Asia/Shanghai
   \`\`\`
3. Run: \`docker-compose up -d\`

## Volumes

- \`/data\` - Library Markdown files (user data)
- \`/app-data\` - Application database, config, logs

## Access

Open http://your-fnos-ip:8080 in your browser.

## First Run

On first access, you'll be guided through the setup wizard to create an admin account.
`;

  writeFileSync(resolve(fnosDir, 'README.md'), readme);

  console.log('✅ FNOS package created at dist/fnos/');
}

main().catch((err) => {
  console.error('❌ FNOS package creation failed:', err);
  process.exit(1);
});
