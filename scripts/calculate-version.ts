#!/usr/bin/env bun

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'bun';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');

type Version = [major: number, minor: number, patch: number];

function parse(value: string): Version | null {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(a: Version, b: Version): number {
  const major = a[0] - b[0];
  if (major !== 0) return major;
  const minor = a[1] - b[1];
  if (minor !== 0) return minor;
  return a[2] - b[2];
}

/** 版本变更等级：breaking > feature > fix > none */
type Bump = 'breaking' | 'feature' | 'fix' | 'none';

function bumpFor(commits: string): Bump {
  let bump: Bump = 'none';
  for (const line of commits.split('\n')) {
    const subject = line.trim();
    if (!subject) continue;
    if (subject.includes('!:')) return 'breaking';
    if (subject.startsWith('feat')) bump = 'feature';
    else if (subject.startsWith('fix') && bump === 'none') bump = 'fix';
  }
  return bump;
}

function applyBump(base: Version, bump: Bump): Version {
  const [major, minor, patch] = base;
  if (bump === 'breaking') return [major + 1, 0, 0];
  if (bump === 'feature') return [major, minor + 1, 0];
  if (bump === 'fix') return [major, minor, patch + 1];
  return base;
}

async function main() {
  // Highest reachable release tag by version order. `git describe` returns the
  // most recently *created* tag, which is not necessarily the newest version
  // (a late backport tag made later releases compute a downgrade).
  const tagList = (await $`git tag --merged HEAD --list "v*"`.cwd(ROOT).text())
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const versions = tagList
    .map((tag) => ({ tag, version: parse(tag) }))
    .filter((entry): entry is { tag: string; version: Version } => entry.version !== null)
    .sort((a, b) => compare(a.version, b.version));

  const latest = versions.at(-1);
  if (!latest) {
    console.log('0.1.0');
    return;
  }

  const commits = (await $`git log ${latest.tag}..HEAD --pretty=format:%s`.cwd(ROOT).text()).trim();
  const next = applyBump(latest.version, bumpFor(commits));

  if (compare(next, latest.version) <= 0) {
    console.log(JSON.stringify({ version: `${next[0]}.${next[1]}.${next[2]}`, bump: 'none' }));
    return;
  }

  console.log(
    JSON.stringify({ version: `${next[0]}.${next[1]}.${next[2]}`, bump: bumpFor(commits) })
  );
}

main().catch((err) => {
  console.error('❌ Version calculation failed:', err);
  process.exit(1);
});
