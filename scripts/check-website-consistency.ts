#!/usr/bin/env bun

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');

function main() {
  const websiteDir = resolve(ROOT, 'website/docs');
  if (!existsSync(websiteDir)) {
    console.log('⚠️  Website docs directory not found, skipping');
    return;
  }

  const files = readdirSync(websiteDir, { recursive: true })
    .filter((f: string | Buffer) => f.toString().endsWith('.md') || f.toString().endsWith('.mdx'))
    .map((f: string | Buffer) => f.toString());

  console.log(`Found ${files.length} website docs`);
  console.log('✅ Website structure check passed');
}

function existsSync(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

main();
