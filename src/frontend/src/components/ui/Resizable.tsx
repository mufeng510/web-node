import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../../lib/utils';

export interface ResizableProps {
  orientation?: 'horizontal' | 'vertical';
  size: number;
  onSizeChange: (size: number) => void;
  onSizeCommit?: (size: number) => void;
  onReset?: () => void;
  min?: number;
  max?: number;
  step?: number;
  firstLabel?: string;
  first: ReactNode;
  second: ReactNode;
  className?: string;
}

export const Resizable = forwardRef<HTMLDivElement, ResizableProps>(
  (
    {
      orientation = 'horizontal',
      size,
      onSizeChange,
      onSizeCommit,
      onReset,
      min = 160,
      max = 640,
      step = 16,
      firstLabel = 'Resize',
      first,
      second,
      className,
    },
    ref
  ) => {
    const horizontal = orientation === 'horizontal';
    const [dragging, setDragging] = useState(false);
    const startRef = useRef({ coord: 0, size: 0 });
    const lastSizeRef = useRef(size);
    const detachRef = useRef<(() => void) | null>(null);
    const changeRef = useRef(onSizeChange);
    const commitRef = useRef(onSizeCommit);

    useEffect(() => {
      changeRef.current = onSizeChange;
      commitRef.current = onSizeCommit;
    });

    useEffect(() => {
      return () => {
        detachRef.current?.();
      };
    }, []);

    const clamp = (raw: number) => {
      const snapped = min + Math.round((raw - min) / step) * step;
      return Math.min(Math.max(snapped, min), max);
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      startRef.current = { coord: horizontal ? event.clientX : event.clientY, size };
      lastSizeRef.current = size;
      setDragging(true);

      const handleMove = (moveEvent: PointerEvent) => {
        const coord = horizontal ? moveEvent.clientX : moveEvent.clientY;
        const raw = startRef.current.size + (coord - startRef.current.coord);
        const next = clamp(raw);
        lastSizeRef.current = next;
        changeRef.current(next);
      };
      const remove = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };
      const handleUp = () => {
        remove();
        detachRef.current = null;
        setDragging(false);
        commitRef.current?.(lastSizeRef.current);
      };
      detachRef.current = remove;
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    };

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const decreaseKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
      const increaseKey = horizontal ? 'ArrowRight' : 'ArrowDown';
      let next: number;
      if (event.key === decreaseKey) {
        next = clamp(size - step);
      } else if (event.key === increaseKey) {
        next = clamp(size + step);
      } else if (event.key === 'Home') {
        next = min;
      } else if (event.key === 'End') {
        next = max;
      } else {
        return;
      }
      event.preventDefault();
      onSizeChange(next);
      onSizeCommit?.(next);
    };

    const lineClassName = horizontal
      ? 'w-px h-full mx-auto bg-border'
      : 'h-px w-full my-auto bg-border';

    return (
      <div
        ref={ref}
        className={cn('grid', dragging && 'select-none', className)}
        style={
          horizontal
            ? {
                gridTemplateColumns: `${size}px 6px minmax(0, 1fr)`,
                // The cross axis is pinned to the container, never to the
                // content. An auto row would let a tall pane push the whole
                // region past the shell's height, and every `h-full` inside it
                // would stop resolving to anything.
                gridTemplateRows: 'minmax(0, 1fr)',
              }
            : {
                gridTemplateRows: `${size}px 6px minmax(0, 1fr)`,
                gridTemplateColumns: 'minmax(0, 1fr)',
              }
        }
      >
        {first}
        {/* biome-ignore lint/a11y/useSemanticElements: a resize handle must be a focusable div carrying aria-valuenow/min/max */}
        <div
          role="separator"
          aria-orientation={horizontal ? 'vertical' : 'horizontal'}
          aria-valuenow={size}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-label={firstLabel}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
          onDoubleClick={() => onReset?.()}
          className={cn(
            'relative flex touch-none select-none',
            horizontal ? 'cursor-col-resize' : 'cursor-row-resize',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
          )}
        >
          <div className={cn(lineClassName, dragging && 'bg-primary')} />
        </div>
        {second}
      </div>
    );
  }
);

Resizable.displayName = 'Resizable';
