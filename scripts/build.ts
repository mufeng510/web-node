#!/usr/bin/env bun

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'bun';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');

async function main() {
  console.log('🏗️  Building Web Note...');

  if (!existsSync(resolve(ROOT, 'dist'))) {
    mkdirSync(resolve(ROOT, 'dist'), { recursive: true });
  }

  console.log('📦 Installing dependencies...');
  await $`bun install --frozen-lockfile`.cwd(ROOT);

  console.log('🔍 Running lint...');
  try {
    await $`bun run lint`.cwd(ROOT);
  } catch {
    console.warn('⚠️  Lint failed, continuing...');
  }

  console.log('🧪 Running tests...');
  try {
    await $`bun run test`.cwd(ROOT);
  } catch {
    console.warn('⚠️  Tests failed, continuing...');
  }

  console.log('🏗️  Building frontend...');
  await $`bunx vite build`.cwd(ROOT);

  console.log('✅ Build complete!');
}

import { existsSync, mkdirSync } from 'node:fs';

main().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
