import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fileRoutes from '@backend/modules/files/routes.js';
import { checkLibraryAccess } from '@backend/modules/libraries/access.js';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@backend/middleware/auth.middleware.js', () => ({
  authMiddleware: () => async (c: unknown, next: () => Promise<void>) => {
    (c as { set: (k: string, v: string) => void }).set('userId', 'test-user');
    (c as { set: (k: string, v: string) => void }).set('userRole', 'admin');
    await next();
  },
}));

vi.mock('@backend/modules/libraries/access.js', () => ({
  checkLibraryAccess: vi.fn(),
}));

vi.mock('@backend/db/index.js', () => ({
  getDb: () => ({
    query: {
      files: {
        findFirst: async () => ({ id: 'f1', version: 1 }),
        findMany: async () => [],
      },
    },
    update: () => ({ set: () => ({ where: async () => {} }) }),
    insert: () => ({ values: async () => {} }),
  }),
  closeDb: vi.fn(),
  schema: {},
}));

const mockedAccess = vi.mocked(checkLibraryAccess);

let dataRoot: string;
let notesDir: string;

function app() {
  const app = new Hono();
  app.route('/files', fileRoutes);
  return app;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

beforeAll(async () => {
  process.env.MASTER_ENCRYPTION_KEY = 'test-master-key-0123456789abcdef';
  dataRoot = await mkdtemp(join(tmpdir(), 'webnote-file-open-'));
  process.env.DATA_ROOT = dataRoot;
  notesDir = join(dataRoot, 'notes');
  await mkdir(join(notesDir, '子目录'), { recursive: true });
  await writeFile(join(notesDir, '便签.md'), '# hello 便签');
  await writeFile(join(notesDir, '子目录', '深层.md'), '# deep');
  await writeFile(join(notesDir, 'plain.md'), '# plain');
});

afterAll(async () => {
  await rm(dataRoot, { recursive: true, force: true });
});

describe('fileRoutes wildcard params (Hono 4.13 has no param(*))', () => {
  it('读取根目录中文文件名', async () => {
    mockedAccess.mockResolvedValue({ library: { id: 'lib1', path: notesDir } } as never);
    const res = await app().request(`/files/lib1/${encodePath('便签.md')}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { content: string } };
    expect(body.success).toBe(true);
    expect(body.data.content).toBe('# hello 便签');
  });

  it('读取嵌套中文路径', async () => {
    mockedAccess.mockResolvedValue({ library: { id: 'lib1', path: notesDir } } as never);
    const res = await app().request(`/files/lib1/${encodePath('子目录/深层.md')}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { content: string } };
    expect(body.data.content).toBe('# deep');
  });

  it('静态 tree 路由不被贪婪参数吞掉', async () => {
    mockedAccess.mockResolvedValue({ library: { id: 'lib1', path: notesDir } } as never);
    const res = await app().request('/files/lib1/tree');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { tree: { name: string }[] };
    };
    expect(body.data.tree.map((n) => n.name)).toContain('便签.md');
  });

  it('PATCH 中文文件', async () => {
    mockedAccess.mockResolvedValue({ library: { id: 'lib1', path: notesDir } } as never);
    const res = await app().request(`/files/lib1/${encodePath('plain.md')}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '# updated' }),
    });
    expect(res.status).toBe(200);
  });
});
