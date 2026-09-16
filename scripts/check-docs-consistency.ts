#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');

function main() {
  const readmeEn = readFileSync(resolve(ROOT, 'README.md'), 'utf-8');
  const readmeZh = readFileSync(resolve(ROOT, 'README.zh-CN.md'), 'utf-8');

  // Extract headings
  const enHeadings = readmeEn.match(/^#{1,3}\s+(.+)$/gm) || [];
  const zhHeadings = readmeZh.match(/^#{1,3}\s+(.+)$/gm) || [];

  if (enHeadings.length !== zhHeadings.length) {
    console.error(`❌ Heading count mismatch: EN=${enHeadings.length}, ZH=${zhHeadings.length}`);
    process.exit(1);
  }

  console.log('✅ README heading structure matches');
}

main();
