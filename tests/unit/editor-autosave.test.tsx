import { Editor } from '@/frontend/src/pages/Editor';
import { api } from '@/frontend/src/services/api';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/frontend/src/services/api', () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>;
const mockedPatch = api.patch as unknown as ReturnType<typeof vi.fn>;
const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>;

/** 与 Editor.tsx 里的 AUTOSAVE_DELAY_MS 保持一致 */
const AUTOSAVE_DELAY_MS = 1500;

let navigateTo: ((path: string) => void) | null = null;

function NavCapture() {
  navigateTo = useNavigate();
  return null;
}

function renderAt(path: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <NavCapture />
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
    await vi.advanceTimersByTimeAsync(0);
  });
}

/** 推进假时钟，让防抖计时器到期 */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function typeInto(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function statusLabel(container: HTMLElement) {
  const dot = container.querySelector('span.inline-flex.items-center.gap-1\\.5');
  return dot?.textContent?.trim() ?? '';
}

describe('Editor autosave', () => {
  let mounted: { container: HTMLDivElement; root: ReturnType<typeof createRoot> } | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    mockedGet.mockReset();
    mockedPatch.mockReset();
    mockedPost.mockReset();
    mockedGet.mockResolvedValue({ success: true, data: { content: '# hello' } });
    mockedPatch.mockResolvedValue({ success: true, data: {} });
    mockedPost.mockResolvedValue({ success: true, data: {} });
  });

  afterEach(() => {
    act(() => {
      mounted?.root.unmount();
    });
    mounted?.container.remove();
    mounted = null;
    vi.useRealTimers();
  });

  it('停止输入后自动保存', async () => {
    mounted = renderAt('/editor/lib-1/notes/a.md');
    await flush();
    await flush();

    const textarea = mounted.container.querySelector(
      'textarea[aria-label="Markdown source"]'
    ) as HTMLTextAreaElement;

    act(() => {
      typeInto(textarea, '# hello\nauto');
    });

    // 还没到防抖时间，不该写盘
    await advance(AUTOSAVE_DELAY_MS - 100);
    expect(mockedPatch).not.toHaveBeenCalled();

    // 停手足够久后自动写盘
    await advance(200);
    await flush();

    expect(mockedPatch).toHaveBeenCalledWith('/files/lib-1/notes/a.md', {
      content: '# hello\nauto',
    });
  });

  it('连续输入会重置防抖，不产生多次写盘', async () => {
    mounted = renderAt('/editor/lib-1/notes/a.md');
    await flush();
    await flush();

    const textarea = mounted.container.querySelector(
      'textarea[aria-label="Markdown source"]'
    ) as HTMLTextAreaElement;

    for (const value of ['a', 'ab', 'abc']) {
      act(() => {
        typeInto(textarea, value);
      });
      await advance(AUTOSAVE_DELAY_MS - 200);
    }

    expect(mockedPatch).not.toHaveBeenCalled();

    await advance(300);
    await flush();

    expect(mockedPatch).toHaveBeenCalledTimes(1);
    expect(mockedPatch).toHaveBeenCalledWith('/files/lib-1/notes/a.md', { content: 'abc' });
  });

  it('保存成功后状态显示为已保存', async () => {
    mounted = renderAt('/editor/lib-1/notes/a.md');
    await flush();
    await flush();

    expect(statusLabel(mounted.container)).toBe('Saved');

    const textarea = mounted.container.querySelector(
      'textarea[aria-label="Markdown source"]'
    ) as HTMLTextAreaElement;

    act(() => {
      typeInto(textarea, '# hello\nmore');
    });
    expect(statusLabel(mounted.container)).toBe('Unsaved changes');

    await advance(AUTOSAVE_DELAY_MS + 100);
    await flush();

    expect(statusLabel(mounted.container)).toBe('Saved');
  });

  it('保存失败时提示错误且不自动重试', async () => {
    mockedPatch.mockRejectedValue(new Error('disk full'));

    mounted = renderAt('/editor/lib-1/notes/a.md');
    await flush();
    await flush();

    const textarea = mounted.container.querySelector(
      'textarea[aria-label="Markdown source"]'
    ) as HTMLTextAreaElement;

    act(() => {
      typeInto(textarea, '# hello\nboom');
    });

    await advance(AUTOSAVE_DELAY_MS + 100);
    await flush();

    expect(statusLabel(mounted.container)).toBe('Save failed');
    expect(mounted.container.textContent).toContain('disk full');

    // 失败后不继续自动重试
    await advance(AUTOSAVE_DELAY_MS * 3);
    await flush();
    expect(mockedPatch).toHaveBeenCalledTimes(1);
  });

  it('新文件（尚不存在）不自动写盘，仍需手动保存', async () => {
    mockedGet.mockResolvedValue({ success: false });

    mounted = renderAt('/editor/lib-1');
    await flush();

    const textarea = mounted.container.querySelector(
      'textarea[aria-label="Markdown source"]'
    ) as HTMLTextAreaElement;

    act(() => {
      typeInto(textarea, 'brand new content');
    });

    await advance(AUTOSAVE_DELAY_MS * 2);
    await flush();

    expect(mockedPost).not.toHaveBeenCalled();
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  it('切换笔记时保存旧内容，且不会把新笔记误标为未保存', async () => {
    mockedGet.mockImplementation((url: string) =>
      Promise.resolve({
        success: true,
        data: { content: url.includes('a.md') ? '# hello' : '# other' },
      })
    );

    mounted = renderAt('/editor/lib-1/notes/a.md');
    await flush();
    await flush();

    const textarea = mounted.container.querySelector(
      'textarea[aria-label="Markdown source"]'
    ) as HTMLTextAreaElement;

    act(() => {
      typeInto(textarea, '# hello\npending');
    });

    // 还没到防抖时间就切走：旧内容仍要落盘
    act(() => {
      navigateTo?.('/editor/lib-1/notes/b.md');
    });
    await flush();
    await flush();

    expect(mockedPatch).toHaveBeenCalledWith('/files/lib-1/notes/a.md', {
      content: '# hello\npending',
    });

    // 新笔记加载完是干净的，不该被旧笔记迟到的保存结果标成未保存
    await advance(AUTOSAVE_DELAY_MS * 2);
    await flush();

    expect(statusLabel(mounted.container)).toBe('Saved');
    // 新笔记的内容不该被自动写盘
    expect(mockedPatch).not.toHaveBeenCalledWith('/files/lib-1/notes/b.md', expect.anything());
  });
});
