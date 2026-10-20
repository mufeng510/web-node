import {
  type PointerEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const WIDTH_KEY = 'right-rail-width';

/** Matches `--right-sidebar-w`; the rail never needs to be wider than the design. */
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 240;
const MAX_WIDTH = 480;

export interface RailContent {
  /**
   * Identity of what the rail is showing, usually the note path. Changing it
   * remounts the panel, which drops stale data and scroll position when the
   * page switches notes.
   */
  key: string;
  node: ReactNode;
}

interface RightRailValue {
  content: RailContent | null;
  setContent: (content: RailContent | null) => void;
  width: number;
  setWidth: (width: number) => void;
}

const RightRailContext = createContext<RightRailValue | null>(null);

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_KEY);
    const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed));
  } catch {
    // storage unavailable — the default width still applies
  }
  return DEFAULT_WIDTH;
}

export function RightRailProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<RailContent | null>(null);
  const [width, setWidthState] = useState(readStoredWidth);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      // storage unavailable — the width still applies for this session
    }
  }, [width]);

  const setContentStable = useCallback((next: RailContent | null) => setContent(next), []);
  const setWidth = useCallback((next: number) => {
    setWidthState(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
  }, []);

  const value = useMemo(
    () => ({ content, setContent: setContentStable, width, setWidth }),
    [content, setContentStable, width, setWidth]
  );

  return <RightRailContext.Provider value={value}>{children}</RightRailContext.Provider>;
}

/**
 * Falls back to an inert value when there is no provider, so a page that offers
 * a rail panel still renders on its own — in tests, or mounted outside the shell.
 */
const INERT_RAIL: RightRailValue = {
  content: null,
  setContent: () => {},
  width: DEFAULT_WIDTH,
  setWidth: () => {},
};

export function useRightRail(): RightRailValue {
  return useContext(RightRailContext) ?? INERT_RAIL;
}

/**
 * Shows `node` in the rail for as long as the calling page is mounted.
 *
 * `node` must be memoised by the caller on its own inputs. Storing it in context
 * state means a fresh element on every render would re-register on every render,
 * and since registering re-renders the shell — which renders this page again —
 * that is a loop. Memoising keeps the identity stable across re-renders, so the
 * effect below settles after one pass.
 *
 * The cleanup is unconditional on purpose: a guard such as `if (!path) return`
 * would leave the previous page's panel on screen for the rest of the session.
 */
export function useRegisterRail(key: string | null, node: ReactNode): void {
  const { setContent } = useRightRail();

  useEffect(() => {
    if (key === null) return;
    setContent({ key, node });
    return () => setContent(null);
  }, [key, node, setContent]);
}

const KEYBOARD_STEP = 16;

/**
 * The rail and its resize handle.
 *
 * It is deliberately a sibling of `<main>` rather than a child: `useRouteFocus`
 * looks up `#main-content h1` in document order, so a heading inside the rail
 * would be announced as the page name and pull focus out of the note.
 *
 * `role="separator"` reports the direction of separation, and since the rail is
 * the last pane, moving the handle left makes it wider — the opposite of the
 * left sidebar's arrow mapping.
 */
export function RightRailSlot() {
  const { content, width, setWidth } = useRightRail();
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  if (!content) return null;

  const clampToViewport = (next: number) => {
    // Both rails are independently draggable, so their sum can outgrow the
    // window and squeeze the note to nothing.
    const available = window.innerWidth - MIN_WIDTH;
    setWidth(Math.min(next, Math.max(MIN_WIDTH, available)));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidth: width };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    clampToViewport(drag.startWidth - (event.clientX - drag.startX));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  return (
    <>
      {/* A resize handle has to be a focusable element that reports its value. */}
      <div
        role="separator"
        aria-label="Resize right panel"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') setWidth(width + KEYBOARD_STEP);
          else if (event.key === 'ArrowRight') setWidth(width - KEYBOARD_STEP);
          else return;
          event.preventDefault();
        }}
        className="w-px shrink-0 cursor-col-resize touch-none bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <aside
        // Remounting on key change is what drops a previous note's headings.
        key={content.key}
        style={{ width }}
        className="hidden shrink-0 overflow-y-auto border-l border-border bg-bg-elevated lg:flex lg:flex-col"
      >
        {content.node}
      </aside>
    </>
  );
}
