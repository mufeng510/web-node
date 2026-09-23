import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanLibraryTree } from '@backend/modules/libraries/scanner';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let dataRoot: string;

beforeAll(async () => {
  process.env.MASTER_ENCRYPTION_KEY = 'test-master-key-0123456789abcdef';
  dataRoot = await mkdtemp(join(tmpdir(), 'webnote-scan-'));
  process.env.DATA_ROOT = dataRoot;
  await mkdir(join(dataRoot, 'notes', 'sub'), { recursive: true });
  await writeFile(join(dataRoot, 'notes', 'sub', 'b.md'), '# b');
  await writeFile(join(dataRoot, 'notes', 'top.md'), '# top');
});

afterAll(async () => {
  await rm(dataRoot, { recursive: true, force: true });
});

describe('scanLibraryTree', () => {
  it('子目录只列出自己的内容，不重复根目录', async () => {
    const tree = await scanLibraryTree('notes');

    const sub = tree.find((n) => n.name === 'sub');
    expect(sub?.isDir).toBe(true);
    // buggy 实现会把根目录条目（sub 自身）重复嵌进去
    expect(sub?.children?.map((c) => c.name)).toEqual(['b.md']);
    expect(tree.map((n) => n.name).sort()).toEqual(['sub', 'top.md']);
  });
});
