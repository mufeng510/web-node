import { LeftSidebar } from '@/frontend/src/components/layout/LeftSidebar';
import { api } from '@/frontend/src/services/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, act, useState } from 'react';
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
    mtime: new Date().toISOString(),
  },
];

function withProviders(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

/** react-query resolves across several ticks, so poll instead of a single flush. */
async function waitFor(predicate: () => boolean, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
}

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
        withProviders(
          <LeftSidebar
            libraries={[{ id: 'lib-1', name: 'Notes' }]}
            currentLibrary={{ id: 'lib-1', name: 'Notes' }}
            onLibraryChange={() => undefined}
          />
        )
      );
    });
    await waitFor(() => container.textContent?.includes('readme.md') ?? false);

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
          <LeftSidebar
            libraries={[
              { id: 'lib-1', name: 'One' },
              { id: 'lib-2', name: 'Two' },
            ]}
            currentLibrary={{ id, name: id }}
            onLibraryChange={() => undefined}
          />
        </>
      );
    }

    act(() => {
      root = createRoot(container);
      root.render(withProviders(<Switcher />));
    });
    await waitFor(() => mockedGet.mock.calls.length > 0);

    const button = container.querySelector('button') as HTMLButtonElement;
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitFor(() => mockedGet.mock.calls.some((call) => call[0] === '/files/lib-2/tree'));

    expect(mockedGet).toHaveBeenCalledWith('/files/lib-2/tree');
  });

  it('左栏只渲染内容导航，不含设置类入口', () => {
    mockedGet.mockResolvedValue({ success: true, data: { tree: [] } });

    act(() => {
      root = createRoot(container);
      root.render(
        withProviders(
          <LeftSidebar
            libraries={[{ id: 'lib-1', name: 'Notes' }]}
            currentLibrary={{ id: 'lib-1', name: 'Notes' }}
            onLibraryChange={() => undefined}
          />
        )
      );
    });

    const labels = [...container.querySelectorAll('nav a')].map((a) => a.textContent);
    expect(labels).toEqual(['Dashboard', 'Search', 'Notifications', 'Tasks', 'AI Assistant']);
    for (const gone of ['Settings', 'Diagnostics', 'Users', 'Audit Log', 'MCP Tokens', 'Library']) {
      expect(labels).not.toContain(gone);
    }
  });

  it('文件树排在导航按钮区之前，按钮区因此不会被树挤出视口', async () => {
    mockedGet.mockResolvedValue({ success: true, data: { tree: treeData } });

    act(() => {
      root = createRoot(container);
      root.render(
        withProviders(
          <LeftSidebar
            libraries={[{ id: 'lib-1', name: 'Notes' }]}
            currentLibrary={{ id: 'lib-1', name: 'Notes' }}
            onLibraryChange={() => undefined}
          />
        )
      );
    });
    await waitFor(() => container.textContent?.includes('readme.md') ?? false);

    const aside = container.querySelector('aside');
    const tree = aside?.querySelector('[role="tree"]') as HTMLElement | null;
    const nav = aside?.querySelector('nav[aria-label="主导航"]') as HTMLElement | null;
    expect(tree).toBeTruthy();
    expect(nav).toBeTruthy();

    // The tree is the flexible region (it scrolls); the rail below it keeps a
    // fixed height, so the two never compete for the sidebar's height.
    const treeComesFirst =
      (tree as HTMLElement).compareDocumentPosition(nav as HTMLElement) &
      Node.DOCUMENT_POSITION_FOLLOWING;
    expect(treeComesFirst).toBeTruthy();
    expect((tree as HTMLElement).className).toContain('flex-1');
    expect((tree as HTMLElement).className).toContain('overflow-y-auto');
    expect((nav as HTMLElement).className).toContain('h-[var(--sidebar-nav-h)]');
  });
});
