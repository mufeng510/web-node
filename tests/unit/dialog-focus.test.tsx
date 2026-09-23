import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/frontend/src/components/ui/Dialog';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// 模拟 Dashboard 的用法：onOpenChange 是每次渲染都新建的内联函数，
// 输入框打字触发 setState → 父组件重渲染
function TypingHost({ onClose }: { onClose: (open: boolean) => void }) {
  const [text, setText] = useState('');
  return (
    <Dialog open onOpenChange={() => onClose(true)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test</DialogTitle>
          <DialogDescription>desc</DialogDescription>
        </DialogHeader>
        <input aria-label="name" value={text} onChange={(e) => setText(e.target.value)} />
      </DialogContent>
    </Dialog>
  );
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Dialog focus regression', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;
  // 注意：jsdom 里 <dialog> 不可聚焦，dialog.focus() 是 no-op，
  // 无法用 activeElement 复现；真实浏览器里 open 的 dialog 可聚焦，
  // 每敲一键 effect 重跑就会抢焦点。这里直接断言“重渲染后不再调用 focus”。
  let dialogFocusSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    dialogFocusSpy = vi.spyOn(window.HTMLDialogElement.prototype, 'focus');
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
    vi.restoreAllMocks();
  });

  it('打字触发重渲染后不再调用 dialog.focus() 抢焦点', () => {
    const onClose = vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(<TypingHost onClose={onClose} />);
    });

    const input = container.querySelector('input[aria-label="name"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    // 打开时聚焦一次是预期的
    expect(dialogFocusSpy).toHaveBeenCalledTimes(1);
    dialogFocusSpy.mockClear();

    act(() => {
      input.focus();
    });
    act(() => {
      setNativeInputValue(input, 'a');
    });
    act(() => {
      setNativeInputValue(input, 'ab');
    });

    expect(input.value).toBe('ab');
    // 每次打字都是一次父组件重渲染（+ 全新的 onOpenChange）；
    // buggy 实现里 effect 依赖 onOpenChange，重跑 2 次 → focus 被调用 2 次
    expect(dialogFocusSpy).not.toHaveBeenCalled();
  });

  it('Escape 仍能调用最新的 onOpenChange', () => {
    const onClose = vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(<TypingHost onClose={onClose} />);
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledWith(true);
  });
});
