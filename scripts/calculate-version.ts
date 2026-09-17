#!/usr/bin/env bun

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'bun';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');

async function main() {
  // Get commits since last tag
  const lastTag = (await $`git describe --tags --abbrev=0 2>/dev/null || echo ""`.cwd(ROOT).text()).trim();
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  const commits = (await $`git log ${range} --oneline --pretty=format:"%s"`.cwd(ROOT).text()).trim();

  if (!commits.trim()) {
    console.log('0.0.0');
    return;
  }

  let major = 0;
  let minor = 0;
  let patch = 0;

  if (lastTag) {
    const [, m, n, p] = lastTag.match(/v?(\d+)\.(\d+)\.(\d+)/) || [];
    major = Number.parseInt(m || '0');
    minor = Number.parseInt(n || '0');
    patch = Number.parseInt(p || '0');
  }

  const lines = commits.trim().split('\n');
  let hasBreaking = false;
  let hasFeature = false;
  let hasFix = false;

  for (const line of lines) {
    if (line.includes('!:')) hasBreaking = true;
    else if (line.startsWith('feat')) hasFeature = true;
    else if (line.startsWith('fix')) hasFix = true;
  }

  if (hasBreaking) {
    major++;
    minor = 0;
    patch = 0;
  } else if (hasFeature) {
    minor++;
    patch = 0;
  } else if (hasFix) {
    patch++;
  }

  console.log(`${major}.${minor}.${patch}`);
}

main().catch((err) => {
  console.error('Failed to calculate version:', err);
  process.exit(1);
});
