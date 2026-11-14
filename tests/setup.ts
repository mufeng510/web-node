import { JSDOM } from 'jsdom';
import { afterAll, beforeAll, vi } from 'vitest';

vi.mock('@backend/db/index', () => ({
  getDb: vi.fn(() => ({})),
  closeDb: vi.fn(),
  schema: {},
}));

vi.mock('drizzle-orm/bun-sqlite', () => ({
  drizzle: vi.fn(() => ({})),
}));

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});

// Only `self` differs: lib.dom wants `Window & typeof globalThis`, and a jsdom
// window can never own the Node globals that `typeof globalThis` demands.
// jsdom 没有 matchMedia。测试默认走桌面宽度（1280px），与这些用例编写时
// 假定的宽屏布局一致；需要移动视口的用例可自行覆盖 window.matchMedia。
if (typeof dom.window.matchMedia !== 'function') {
  Object.defineProperty(dom.window, 'matchMedia', {
    configurable: true,
    value: (query: string) => {
      const match = /\(min-width:\s*(\d+)px\)/.exec(query);
      const matches = match ? 1280 >= Number(match[1]) : false;
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      };
    },
  });
}

global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.requestAnimationFrame = dom.window.requestAnimationFrame;
global.cancelAnimationFrame = dom.window.cancelAnimationFrame;

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

Object.defineProperty(global, 'sessionStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterAll(() => {
  vi.unstubAllGlobals();
});
