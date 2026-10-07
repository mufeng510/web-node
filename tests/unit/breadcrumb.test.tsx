import { Breadcrumb, type BreadcrumbItem } from '@/frontend/src/components/ui/Breadcrumb';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function RerenderHost({ makeItems }: { makeItems: (count: number) => BreadcrumbItem[] }) {
  const [items, setItems] = useState<BreadcrumbItem[]>(() => makeItems(6));
  return (
    <div>
      <button type="button" aria-label="Swap items" onClick={() => setItems(makeItems(4))}>
        swap
      </button>
      <Breadcrumb items={items} maxItems={3} />
    </div>
  );
}

describe('Breadcrumb', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;

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

  it('renders nav > ol > li, separators, and marks the last item as the current page', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Seg0', href: '/seg0' },
      { label: 'Seg1', href: '/seg1' },
      { label: 'Seg2' },
      { label: 'Seg3' },
    ];
    act(() => {
      root = createRoot(container);
      root.render(<Breadcrumb items={items} />);
    });

    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav?.tagName).toBe('NAV');
    expect(nav?.querySelector('ol')).not.toBeNull();
    expect(nav?.getAttribute('aria-label')).toBe('Breadcrumb');

    const listItems = Array.from(nav?.querySelectorAll('ol > li') ?? []);
    expect(listItems).toHaveLength(7);
    const separators = listItems.filter((li) => li.getAttribute('aria-hidden') === 'true');
    expect(separators).toHaveLength(3);
    expect(separators.every((li) => li.tagName === 'LI')).toBe(true);
    expect(listItems[0]?.getAttribute('aria-hidden')).toBeNull();
    expect(listItems[listItems.length - 1]?.getAttribute('aria-hidden')).toBeNull();

    const current = container.querySelector('[aria-current="page"]');
    expect(current).not.toBeNull();
    expect(current?.textContent).toBe('Seg3');
    expect(current?.tagName).toBe('SPAN');
    expect(current?.closest('a')).toBeNull();
    expect(current?.closest('button')).toBeNull();
  });

  it('renders a middle item with href as an anchor with that exact href', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', href: '/home' },
      { label: 'Docs', href: '/docs' },
      { label: 'Now' },
    ];
    act(() => {
      root = createRoot(container);
      root.render(<Breadcrumb items={items} />);
    });

    const link = container.querySelector('a[href="/docs"]');
    expect(link).not.toBeNull();
    expect(link?.tagName).toBe('A');
    expect(link?.textContent).toBe('Docs');
  });

  it('renders a middle item with only onClick as a button and fires the callback', () => {
    const onClick = vi.fn();
    const items: BreadcrumbItem[] = [
      { label: 'Home', href: '/home' },
      { label: 'Go', onClick },
      { label: 'Now' },
    ];
    act(() => {
      root = createRoot(container);
      root.render(<Breadcrumb items={items} />);
    });

    const button = Array.from(container.querySelectorAll('button')).find(
      (el) => el.textContent === 'Go'
    );
    expect(button).toBeDefined();
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
    act(() => {
      (button as HTMLButtonElement).click();
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a middle item with neither href nor onClick as an inert span', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', href: '/home' },
      { label: 'Static' },
      { label: 'Now' },
    ];
    act(() => {
      root = createRoot(container);
      root.render(<Breadcrumb items={items} />);
    });

    const spans = Array.from(container.querySelectorAll('span')).filter(
      (el) => el.textContent === 'Static'
    );
    expect(spans).toHaveLength(1);
    const span = spans[0] as HTMLSpanElement;
    expect(span.tagName).toBe('SPAN');
    expect(span.hasAttribute('tabindex')).toBe(false);
    expect(span.hasAttribute('href')).toBe(false);
    expect(span.closest('a')).toBeNull();
    expect(span.closest('button')).toBeNull();
  });

  it('uses the default aria-label and honours a custom one', () => {
    const items: BreadcrumbItem[] = [{ label: 'One' }, { label: 'Two' }];
    act(() => {
      root = createRoot(container);
      root.render(<Breadcrumb items={items} />);
    });
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Breadcrumb');

    act(() => {
      root?.render(<Breadcrumb items={items} ariaLabel="Sections" />);
    });
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Sections');
  });

  it('collapses overflow behind a toggle and reveals the full list on click', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Seg0', href: '/seg0' },
      { label: 'Seg1', href: '/seg1' },
      { label: 'Seg2', href: '/seg2' },
      { label: 'Seg3', href: '/seg3' },
      { label: 'Seg4', href: '/seg4' },
      { label: 'Seg5' },
    ];
    act(() => {
      root = createRoot(container);
      root.render(<Breadcrumb items={items} maxItems={3} />);
    });

    const collapsed = container.textContent ?? '';
    expect(collapsed).toContain('Seg0');
    expect(collapsed).toContain('Seg4');
    expect(collapsed).toContain('Seg5');
    expect(collapsed).not.toContain('Seg1');
    expect(collapsed).not.toContain('Seg2');
    expect(collapsed).not.toContain('Seg3');

    const toggle = container.querySelector('button[aria-label="Show full path"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.textContent).toBe('…');

    act(() => {
      (toggle as HTMLButtonElement).click();
    });

    const expanded = container.textContent ?? '';
    expect(expanded).toContain('Seg1');
    expect(expanded).toContain('Seg2');
    expect(expanded).toContain('Seg3');
    expect(container.querySelector('button[aria-label="Show full path"]')).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Show full path"]')?.getAttribute('aria-expanded')
    ).toBe('true');
  });

  it('collapses again when items.length changes after expanding', () => {
    const makeItems = (count: number): BreadcrumbItem[] => [
      ...Array.from({ length: count }, (_, i) => ({ label: `Seg${i}`, href: `/seg${i}` })),
    ];
    act(() => {
      root = createRoot(container);
      root.render(<RerenderHost makeItems={makeItems} />);
    });

    const toggle = container.querySelector('button[aria-label="Show full path"]');
    expect(toggle).not.toBeNull();
    act(() => {
      (toggle as HTMLButtonElement).click();
    });
    expect(
      container.querySelector('button[aria-label="Show full path"]')?.getAttribute('aria-expanded')
    ).toBe('true');
    expect(container.textContent).toContain('Seg1');

    const swap = container.querySelector('button[aria-label="Swap items"]');
    expect(swap).not.toBeNull();
    act(() => {
      (swap as HTMLButtonElement).click();
    });

    expect(
      container.querySelector('button[aria-label="Show full path"]')?.getAttribute('aria-expanded')
    ).toBe('false');
    const afterSwap = container.textContent ?? '';
    expect(afterSwap).toContain('Seg0');
    expect(afterSwap).toContain('Seg3');
    expect(afterSwap).toContain('Seg2');
    expect(afterSwap).not.toContain('Seg1');
  });
});
