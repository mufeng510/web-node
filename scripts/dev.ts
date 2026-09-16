#!/usr/bin/env bun

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'bun';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');

async function main() {
  console.log('🔧 Starting development server...');

  await $`bun install --frozen-lockfile`.cwd(ROOT);

  console.log('📦 Running database migrations...');
  await $`bun run db:migrate`.cwd(ROOT);

  console.log('🚀 Starting dev server...');
  await $`bun run dev`.cwd(ROOT);
}

main().catch((err) => {
  console.error('❌ Dev server failed:', err);
  process.exit(1);
});
