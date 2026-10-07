import { Resizable } from '@/frontend/src/components/ui/Resizable';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

interface HostProps {
  initial?: number;
  orientation?: 'horizontal' | 'vertical';
  min?: number;
  max?: number;
  step?: number;
  firstLabel?: string;
  onSizeChange?: (size: number) => void;
  onSizeCommit?: (size: number) => void;
  onReset?: () => void;
}

function Host({
  initial = 192,
  orientation,
  min,
  max,
  step,
  firstLabel,
  onSizeChange,
  onSizeCommit,
  onReset,
}: HostProps) {
  const [size, setSize] = useState(initial);
  return (
    <Resizable
      orientation={orientation}
      size={size}
      onSizeChange={(next) => {
        onSizeChange?.(next);
        setSize(next);
      }}
      onSizeCommit={onSizeCommit}
      onReset={onReset}
      min={min}
      max={max}
      step={step}
      firstLabel={firstLabel}
      first={<div data-testid="first">first</div>}
      second={<div data-testid="second">second</div>}
    />
  );
}

describe('Resizable', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;

  const surface = () => container.firstElementChild as HTMLElement;
  const separator = () => container.querySelector('[role="separator"]') as HTMLElement;
  const pointer = (type: string, clientX: number, target: EventTarget) => {
    target.dispatchEvent(new PointerEvent(type, { clientX, clientY: 0, bubbles: true }));
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
  });

  it('renders a separator with role, aria orientation, values and label', () => {
    act(() => {
      root = createRoot(container);
      root.render(<Host />);
    });

    const sep = separator();
    expect(sep.getAttribute('role')).toBe('separator');
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
    expect(sep.getAttribute('aria-valuenow')).toBe('192');
    expect(sep.getAttribute('aria-valuemin')).toBe('160');
    expect(sep.getAttribute('aria-valuemax')).toBe('640');
    expect(sep.getAttribute('aria-label')).toBe('Resize');
    expect(sep.getAttribute('tabindex')).toBe('0');
  });

  it('flips aria-orientation to horizontal when orientation is vertical', () => {
    act(() => {
      root = createRoot(container);
      root.render(<Host orientation="vertical" />);
    });

    expect(separator().getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('grows the first pane by step on ArrowRight and shrinks it on ArrowLeft', () => {
    const change = vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(<Host onSizeChange={change} />);
    });
    const sep = separator();

    act(() => {
      sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(sep.getAttribute('aria-valuenow')).toBe('208');
    expect(surface().style.gridTemplateColumns).toContain('208px');
    expect(change).toHaveBeenLastCalledWith(208);

    act(() => {
      sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(sep.getAttribute('aria-valuenow')).toBe('192');
    expect(surface().style.gridTemplateColumns).toContain('192px');
    expect(change).toHaveBeenLastCalledWith(192);
  });

  it('snaps to min on Home and to max on End', () => {
    act(() => {
      root = createRoot(container);
      root.render(<Host />);
    });
    const sep = separator();

    act(() => {
      sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(sep.getAttribute('aria-valuenow')).toBe('160');
    expect(surface().style.gridTemplateColumns).toContain('160px');

    act(() => {
      sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(sep.getAttribute('aria-valuenow')).toBe('640');
    expect(surface().style.gridTemplateColumns).toContain('640px');
  });

  it('updates the size and the grid template during a pointer drag', () => {
    act(() => {
      root = createRoot(container);
      root.render(<Host />);
    });
    const sep = separator();

    act(() => {
      pointer('pointerdown', 100, sep);
    });
    act(() => {
      pointer('pointermove', 132, window);
    });
    act(() => {
      pointer('pointerup', 132, window);
    });

    expect(sep.getAttribute('aria-valuenow')).toBe('224');
    expect(surface().style.gridTemplateColumns).toBe('224px 6px minmax(0, 1fr)');
  });

  it('commits once at the end of a drag and not on pointermove', () => {
    const change = vi.fn();
    const commit = vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(<Host onSizeChange={change} onSizeCommit={commit} />);
    });
    const sep = separator();

    act(() => {
      pointer('pointerdown', 100, sep);
    });
    act(() => {
      pointer('pointermove', 116, window);
    });
    expect(commit).not.toHaveBeenCalled();
    act(() => {
      pointer('pointermove', 132, window);
    });
    expect(commit).not.toHaveBeenCalled();
    expect(change).toHaveBeenCalledTimes(2);
    expect(change).toHaveBeenLastCalledWith(224);

    act(() => {
      pointer('pointerup', 132, window);
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(224);
    expect(change).toHaveBeenCalledTimes(2);
  });

  it('clamps the size at max when dragging past it', () => {
    act(() => {
      root = createRoot(container);
      root.render(<Host />);
    });
    const sep = separator();

    act(() => {
      pointer('pointerdown', 100, sep);
    });
    act(() => {
      pointer('pointermove', 900, window);
    });
    act(() => {
      pointer('pointerup', 900, window);
    });

    expect(sep.getAttribute('aria-valuenow')).toBe('640');
    expect(surface().style.gridTemplateColumns).toBe('640px 6px minmax(0, 1fr)');
  });

  it('calls onReset on separator double-click without changing size itself', () => {
    const reset = vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(<Host onReset={reset} />);
    });

    act(() => {
      separator().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    expect(reset).toHaveBeenCalledTimes(1);
    expect(separator().getAttribute('aria-valuenow')).toBe('192');
  });

  it('keeps a minmax(0, 1fr) trailing track on the matching axis', () => {
    act(() => {
      root = createRoot(container);
      root.render(<Host />);
    });
    expect(surface().style.gridTemplateColumns).toBe('192px 6px minmax(0, 1fr)');
    expect(surface().style.gridTemplateRows).toBe('');

    act(() => {
      root?.render(<Host orientation="vertical" />);
    });
    expect(surface().style.gridTemplateRows).toBe('192px 6px minmax(0, 1fr)');
    expect(surface().style.gridTemplateColumns).toBe('');
  });
});
