import {
  type ReactElement,
  type ReactNode,
  type Ref,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../../lib/utils';

const SUPPORTS_POPOVER =
  typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';

const MENU_ITEM_SELECTOR = '[role^="menuitem"]';
const VIEWPORT_MARGIN = 8;
const TRIGGER_GAP = 4;

export type DropdownMenuAlign = 'start' | 'end';
export type DropdownMenuSide = 'bottom' | 'top';

export interface DropdownMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement<Record<string, unknown>>;
  children: ReactNode;
  align?: DropdownMenuAlign;
  side?: DropdownMenuSide;
  ariaLabel: string;
  className?: string;
  menuClassName?: string;
}

type TriggerWithRef = ReactElement<Record<string, unknown>> & { ref?: Ref<HTMLElement> };

interface Position {
  top?: number;
  left?: number;
  right?: number;
  minWidth: number;
}

/**
 * Dropdown anchored to a trigger, painted in one fixed-position layer.
 *
 * When the Popover API is present the panel is promoted to the top layer, which
 * buys native Escape, native light-dismiss and immunity to `overflow` clipping
 * ancestors. Positioning, dismissal and keyboard handling are identical in both
 * modes, so there is a single code path to reason about and to test.
 *
 * The `m-0 p-0 inset-auto` reset is load-bearing: the UA stylesheet gives
 * `[popover]` `inset: 0` and `margin: auto`, which silently overrides a computed
 * `top` / `left` by re-centring the panel inside the remaining inset band.
 */
export function DropdownMenu({
  open,
  onOpenChange,
  trigger,
  children,
  align = 'start',
  side = 'bottom',
  ariaLabel,
  className,
  menuClassName,
}: DropdownMenuProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const shownRef = useRef(false);
  const wasOpenRef = useRef(false);
  const [position, setPosition] = useState<Position | null>(null);

  if (!isValidElement(trigger)) {
    throw new Error('DropdownMenu: `trigger` must be a React element');
  }

  const measure = useCallback(() => {
    const triggerEl = triggerRef.current;
    const menuEl = menuRef.current;
    if (!triggerEl || !menuEl) return;

    const rect = triggerEl.getBoundingClientRect();
    // Only height is read from the panel, to decide the flip. Horizontal placement
    // uses the trigger alone: a panel measured in the same tick it becomes visible
    // can report a stale width, which silently breaks end-alignment in browsers
    // but not in jsdom.
    const { height } = menuEl.getBoundingClientRect();

    const spaceBelow = window.innerHeight - rect.bottom;
    const flip =
      side === 'bottom' && height > spaceBelow - VIEWPORT_MARGIN && rect.top > spaceBelow;
    const top = flip ? rect.top - height - TRIGGER_GAP : rect.bottom + TRIGGER_GAP;

    setPosition({
      top: Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - height - VIEWPORT_MARGIN)),
      ...(align === 'end'
        ? { right: Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right) }
        : {
            left: Math.max(
              VIEWPORT_MARGIN,
              Math.min(rect.left, window.innerWidth - VIEWPORT_MARGIN)
            ),
          }),
      minWidth: rect.width,
    });
  }, [align, side]);

  useLayoutEffect(() => {
    if (open) {
      measure();
    } else {
      setPosition(null);
    }
  }, [open, measure, children]);

  useLayoutEffect(() => {
    const menuEl = menuRef.current;
    if (!menuEl || !SUPPORTS_POPOVER) return;

    if (open && !shownRef.current) {
      menuEl.showPopover();
      shownRef.current = true;
      measure();
    } else if (!open && shownRef.current) {
      menuEl.hidePopover();
      shownRef.current = false;
    }
  }, [open, children, measure]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onOpenChange(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const menuEl = menuRef.current;
      if (!menuEl) return;
      const focusable = Array.from(menuEl.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  const focusItemAt = (edge: 'first' | 'last') => {
    const items = menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR);
    if (!items || items.length === 0) return;
    const target = edge === 'first' ? items[0] : items[items.length - 1];
    target?.focus();
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const { key } = event;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return;

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? []
    );
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    if (!firstItem || !lastItem) return;

    event.preventDefault();
    if (key === 'Home') {
      firstItem.focus();
      return;
    }
    if (key === 'End') {
      lastItem.focus();
      return;
    }

    const delta = key === 'ArrowDown' ? 1 : -1;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      currentIndex === -1
        ? delta > 0
          ? 0
          : items.length - 1
        : (currentIndex + delta + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const triggerProps = trigger.props;
  const existingRef = (trigger as TriggerWithRef).ref;

  const setTriggerRef = (node: HTMLElement | null) => {
    triggerRef.current = node;
    if (typeof existingRef === 'function') {
      (existingRef as (n: HTMLElement | null) => void)(node);
    } else if (existingRef && typeof existingRef === 'object') {
      (existingRef as { current: HTMLElement | null }).current = node;
    }
  };

  const callTriggerHandler = (
    name: 'onClick' | 'onKeyDown',
    event: React.MouseEvent | React.KeyboardEvent
  ) => {
    const handler = triggerProps[name] as ((e: typeof event) => void) | undefined;
    handler?.(event);
  };

  const enhancedTrigger = cloneElement(trigger, {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: (event: React.MouseEvent) => {
      callTriggerHandler('onClick', event);
      if (!event.defaultPrevented) onOpenChange(!open);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      callTriggerHandler('onKeyDown', event);
      if (event.defaultPrevented) return;

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const edge = event.key === 'ArrowDown' ? 'first' : 'last';
        onOpenChange(true);
        requestAnimationFrame(() => focusItemAt(edge));
      }
    },
    ref: setTriggerRef,
  });

  return (
    <>
      {enhancedTrigger}
      <div
        id={menuId}
        ref={menuRef}
        role="menu"
        aria-label={ariaLabel}
        {...(SUPPORTS_POPOVER ? { popover: 'auto' as const } : {})}
        hidden={SUPPORTS_POPOVER ? undefined : !open}
        tabIndex={-1}
        onKeyDown={handleMenuKeyDown}
        style={
          position
            ? {
                position: 'fixed',
                top: position.top,
                left: position.left,
                right: position.right,
                minWidth: position.minWidth,
              }
            : { position: 'fixed', top: 0, left: 0, visibility: 'hidden' }
        }
        className={cn(
          'z-[var(--z-dropdown)] bg-bg-elevated border border-border rounded-lg shadow-lg',
          'overflow-y-auto overflow-x-hidden overscroll-contain max-h-[min(24rem,var(--shell-h))]',
          'm-0 p-0 inset-auto',
          menuClassName
        )}
      >
        {open && children}
      </div>
    </>
  );
}
