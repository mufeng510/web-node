import { Editor } from '@/frontend/src/pages/Editor';
import { api } from '@/frontend/src/services/api';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/frontend/src/services/api', () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>;
const mockedPatch = api.patch as unknown as ReturnType<typeof vi.fn>;

function renderAt(path: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/editor/:libraryId" element={<Editor />} />
          <Route path="/editor/:libraryId/*" element={<Editor />} />
        </Routes>
      </MemoryRouter>
    );
  });
  return { container, root };
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('Editor open file', () => {
  let mounted: { container: HTMLDivElement; root: ReturnType<typeof createRoot> } | null = null;

  beforeEach(() => {
    mockedGet.mockReset();
    mockedPatch.mockReset();
  });

  afterEach(() => {
    act(() => {
      mounted?.root.unmount();
    });
    mounted?.container.remove();
    mounted = null;
  });

  it('按路由加载文件内容并可保存', async () => {
    mockedGet.mockResolvedValue({ success: true, data: { content: '# hello' } });
    mockedPatch.mockResolvedValue({ success: true, data: {} });

    mounted = renderAt('/editor/lib-1/notes/a.md');
    await flush();
    await flush();

    expect(mockedGet).toHaveBeenCalledWith('/files/lib-1/notes/a.md');
    const textarea = mounted.container.querySelector(
      'textarea[aria-label="Markdown source"]'
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('# hello');

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(textarea, '# hello\nmore');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const saveButton = Array.from(mounted.container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save')
    ) as HTMLButtonElement;
    act(() => {
      saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(mockedPatch).toHaveBeenCalledWith('/files/lib-1/notes/a.md', {
      content: '# hello\nmore',
    });
  });

  it('无路径时显示新建欢迎语且不请求接口', async () => {
    mounted = renderAt('/editor/lib-1');
    await flush();

    expect(mockedGet).not.toHaveBeenCalled();
    const textarea = mounted.container.querySelector(
      'textarea[aria-label="Markdown source"]'
    ) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Welcome to Web Note');
  });
});
