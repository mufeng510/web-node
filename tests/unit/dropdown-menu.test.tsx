import { DropdownMenu } from '@/frontend/src/components/ui/DropdownMenu';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function Host({
  onOpenChange,
  align,
  side,
}: {
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'end';
  side?: 'bottom' | 'top';
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
      align={align}
      side={side}
      ariaLabel="Test menu"
      trigger={
        <button type="button" data-testid="trigger">
          Open
        </button>
      }
    >
      <button type="button" role="menuitem" data-testid="item-1">
        First
      </button>
      <button type="button" role="menuitem" data-testid="item-2">
        Second
      </button>
      <button type="button" role="menuitem" data-testid="item-3">
        Third
      </button>
    </DropdownMenu>
  );
}

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

const q = (container: HTMLElement, testid: string) =>
  container.querySelector(`[data-testid="${testid}"]`) as HTMLElement;

const menu = (container: HTMLElement) => container.querySelector('[role="menu"]') as HTMLElement;

describe('DropdownMenu', () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    ({ container, root } = mount());
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    root = null;
  });

  const openMenu = () => {
    act(() => {
      q(container, 'trigger').click();
    });
  };

  it('wires the trigger with menu semantics', () => {
    act(() => root?.render(<Host />));
    const trigger = q(container, 'trigger');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(menu(container).getAttribute('aria-label')).toBe('Test menu');
  });

  it('reflects open state and reveals items', () => {
    act(() => root?.render(<Host />));
    openMenu();
    expect(q(container, 'trigger').getAttribute('aria-expanded')).toBe('true');
    expect(menu(container).querySelectorAll('[role="menuitem"]')).toHaveLength(3);
  });

  it('closes on Escape and reports the change', () => {
    const onOpenChange = vi.fn();
    act(() => root?.render(<Host onOpenChange={onOpenChange} />));
    openMenu();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(q(container, 'trigger').getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on outside pointerdown but not on inside pointerdown', () => {
    const onOpenChange = vi.fn();
    act(() => root?.render(<Host onOpenChange={onOpenChange} />));
    openMenu();

    act(() => {
      q(container, 'item-2').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onOpenChange).not.toHaveBeenLastCalledWith(false);

    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('ignores pointerdown on the trigger itself', () => {
    const onOpenChange = vi.fn();
    act(() => root?.render(<Host onOpenChange={onOpenChange} />));
    openMenu();
    act(() => {
      q(container, 'trigger').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onOpenChange).not.toHaveBeenLastCalledWith(false);
  });

  it('cycles focus with ArrowDown / ArrowUp and jumps with Home / End', () => {
    act(() => root?.render(<Host />));
    openMenu();

    act(() => {
      q(container, 'item-1').focus();
      menu(container).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );
    });
    expect(document.activeElement).toBe(q(container, 'item-2'));

    act(() => {
      menu(container).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(document.activeElement).toBe(q(container, 'item-3'));

    act(() => {
      menu(container).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );
    });
    expect(document.activeElement).toBe(q(container, 'item-1'));

    act(() => {
      menu(container).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
      );
    });
    expect(document.activeElement).toBe(q(container, 'item-3'));
  });

  it('opens from the keyboard and focuses the first item', async () => {
    act(() => root?.render(<Host />));
    act(() => {
      q(container, 'trigger').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );
    });
    expect(q(container, 'trigger').getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });
    expect(document.activeElement).toBe(q(container, 'item-1'));
  });

  it('returns focus to the trigger after closing', () => {
    act(() => root?.render(<Host />));
    openMenu();
    act(() => {
      q(container, 'item-1').focus();
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.activeElement).toBe(q(container, 'trigger'));
  });

  it('does not steal focus on first mount', () => {
    act(() => root?.render(<Host />));
    expect(document.activeElement).not.toBe(q(container, 'trigger'));
  });

  it('positions below the trigger by default', () => {
    act(() => root?.render(<Host />));
    openMenu();
    const style = menu(container).style;
    expect(style.position).toBe('fixed');
    expect(Number.parseFloat(style.top)).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(style.left)).toBeGreaterThanOrEqual(0);
  });

  it('aligns to the trigger end when asked', () => {
    act(() => root?.render(<Host align="end" />));
    openMenu();
    expect(menu(container).style.position).toBe('fixed');
  });

  it('honours a custom side', () => {
    act(() => root?.render(<Host side="top" />));
    openMenu();
    expect(menu(container).style.position).toBe('fixed');
  });

  it('preserves a ref on the caller-supplied trigger', () => {
    const triggerRef = { current: null as HTMLButtonElement | null };
    function RefHost() {
      const [open, setOpen] = useState(false);
      return (
        <DropdownMenu
          open={open}
          onOpenChange={setOpen}
          ariaLabel="Ref menu"
          trigger={
            <button type="button" data-testid="trigger" ref={triggerRef}>
              Open
            </button>
          }
        >
          <button type="button" role="menuitem" data-testid="item-1">
            First
          </button>
        </DropdownMenu>
      );
    }
    act(() => root?.render(<RefHost />));
    expect(triggerRef.current).toBe(q(container, 'trigger'));
  });

  it('runs the caller-supplied trigger onClick before toggling', () => {
    const order: string[] = [];
    function OrderHost() {
      const [open, setOpen] = useState(false);
      return (
        <DropdownMenu
          open={open}
          onOpenChange={(next) => {
            order.push(`toggle:${next}`);
            setOpen(next);
          }}
          ariaLabel="Order menu"
          trigger={
            <button
              type="button"
              data-testid="trigger"
              onClick={() => {
                order.push('caller');
              }}
            >
              Open
            </button>
          }
        >
          <button type="button" role="menuitem" data-testid="item-1">
            First
          </button>
        </DropdownMenu>
      );
    }
    act(() => root?.render(<OrderHost />));
    openMenu();
    expect(order).toEqual(['caller', 'toggle:true']);
  });

  it('lets the caller suppress toggling via preventDefault', () => {
    function BlockedHost() {
      const [open, setOpen] = useState(false);
      return (
        <DropdownMenu
          open={open}
          onOpenChange={setOpen}
          ariaLabel="Blocked menu"
          trigger={
            <button
              type="button"
              data-testid="trigger"
              onClick={(e) => {
                e.preventDefault();
              }}
            >
              Open
            </button>
          }
        >
          <button type="button" role="menuitem" data-testid="item-1">
            First
          </button>
        </DropdownMenu>
      );
    }
    act(() => root?.render(<BlockedHost />));
    openMenu();
    expect(q(container, 'trigger').getAttribute('aria-expanded')).toBe('false');
  });
});
