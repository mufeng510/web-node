#!/usr/bin/env bun

import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'bun';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');
const APP_DATA = process.env.APP_DATA_ROOT || resolve(ROOT, 'app-data');

async function main() {
  console.log('🗄️  Running database migrations...');

  if (!existsSync(APP_DATA)) {
    mkdirSync(APP_DATA, { recursive: true });
  }

  await $`bunx drizzle-kit migrate`.cwd(ROOT);
  console.log('✅ Migrations complete!');
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
