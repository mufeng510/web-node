import { applyHeadingIds, outlineOf } from '@/frontend/src/lib/markdownOutline';
import { describe, expect, it } from 'vitest';

describe('outlineOf', () => {
  it('lists headings in document order with their depth', () => {
    expect(outlineOf('# One\n\ntext\n\n## Two\n')).toEqual([
      { depth: 1, text: 'One', slug: 'one' },
      { depth: 2, text: 'Two', slug: 'two' },
    ]);
  });

  it('deduplicates repeated headings instead of colliding anchors', () => {
    const slugs = outlineOf('## B\n## B\n## B').map((e) => e.slug);
    expect(slugs).toEqual(['b', 'b-1', 'b-2']);
  });

  it('keeps non-latin headings addressable rather than collapsing them', () => {
    const slugs = outlineOf('# 中文标题\n\n## 第二个标题\n').map((e) => e.slug);
    expect(new Set(slugs).size).toBe(2);
    for (const slug of slugs) expect(slug).not.toBe('');
  });

  it('falls back to a positional slug when a heading has no slug-safe characters', () => {
    const slugs = outlineOf('# !!!\n\n# ???\n').map((e) => e.slug);
    expect(slugs).toEqual(['h-1', 'h-2']);
  });

  it('ignores body text and returns nothing for a note without headings', () => {
    expect(outlineOf('just a paragraph\n\n- a list item\n')).toEqual([]);
  });

  it('is stable across calls so a re-render cannot shift anchors', () => {
    const markdown = '# A\n\n## A\n';
    expect(outlineOf(markdown)).toEqual(outlineOf(markdown));
  });
});

describe('applyHeadingIds', () => {
  it('gives rendered headings the same slugs the outline lists', () => {
    const markdown = '# Title\n\n## Sub\n\n## Sub\n';
    const html = '<h1>Title</h1><p>x</p><h2>Sub</h2><h2>Sub</h2>';
    const entries = outlineOf(markdown);

    const result = applyHeadingIds(html, entries);
    const container = document.createElement('div');
    container.innerHTML = result;

    expect([...container.querySelectorAll('h1, h2')].map((h) => h.id)).toEqual(
      entries.map((e) => e.slug)
    );
  });

  it('leaves headings untouched when the token walk and the tree disagree', () => {
    const entries = outlineOf('# One\n\n## Two\n');
    const container = document.createElement('div');
    container.innerHTML = applyHeadingIds('<h1>Only one</h1>', entries);
    expect(container.querySelector('h1')?.id).toBe('one');
    expect(container.querySelectorAll('h2').length).toBe(0);
  });

  it('returns the html unchanged when there are no headings', () => {
    expect(applyHeadingIds('<p>body</p>', [])).toBe('<p>body</p>');
  });
});
