#!/usr/bin/env bun

import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');
const APP_DATA = process.env.APP_DATA_ROOT || resolve(ROOT, 'app-data');

async function main() {
  console.log('🌱 Seeding database...');

  if (!existsSync(APP_DATA)) {
    mkdirSync(APP_DATA, { recursive: true });
  }

  console.log('✅ Seed complete!');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
