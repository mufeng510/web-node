import { LeftSidebar } from '@/frontend/src/components/layout/LeftSidebar';
import { api } from '@/frontend/src/services/api';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/frontend/src/services/api', () => ({
  api: { get: vi.fn() },
}));

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>;

const treeData = [
  {
    id: 'node-1',
    name: 'readme.md',
    path: '/data/notes/readme.md',
    relativePath: 'readme.md',
    isDir: false,
    size: 10,
    mtime: new Date(),
  },
];

describe('LeftSidebar file tree', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockedGet.mockReset();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
  });

  it('library 变化时请求文件树并渲染节点', async () => {
    mockedGet.mockResolvedValue({ success: true, data: { tree: treeData } });

    act(() => {
      root = createRoot(container);
      root.render(
        <MemoryRouter>
          <LeftSidebar library={{ id: 'lib-1' }} />
        </MemoryRouter>
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockedGet).toHaveBeenCalledWith('/files/lib-1/tree');
    expect(container.textContent).toContain('readme.md');
  });

  it('切换 library 时重新请求', async () => {
    mockedGet.mockResolvedValue({ success: true, data: { tree: [] } });

    function Switcher() {
      const [id, setId] = useState('lib-1');
      return (
        <>
          <button type="button" onClick={() => setId('lib-2')}>
            switch
          </button>
          <LeftSidebar library={{ id }} />
        </>
      );
    }

    act(() => {
      root = createRoot(container);
      root.render(
        <MemoryRouter>
          <Switcher />
        </MemoryRouter>
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const button = container.querySelector('button') as HTMLButtonElement;
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockedGet).toHaveBeenCalledWith('/files/lib-2/tree');
  });
});
