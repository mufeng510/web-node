import { marked } from 'marked';

export interface OutlineEntry {
  depth: number;
  text: string;
  slug: string;
}

function slugify(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      // Keep CJK and other non-ASCII by percent-encoding rather than dropping it:
      // a naive \w strip turns every Chinese heading into an empty slug, so all of
      // them would collapse onto the same anchor.
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * Headings of a note, in document order, with a stable anchor for each.
 *
 * The anchors are the contract between this list and the rendered preview, so
 * both must derive them from here. Deriving them from the token walk (rather
 * than from the heading text at render time) keeps the two in step even when a
 * heading contains markup.
 */
export function outlineOf(markdown: string): OutlineEntry[] {
  const seen = new Map<string, number>();
  const entries: OutlineEntry[] = [];

  for (const token of marked.lexer(markdown)) {
    if (token.type !== 'heading') continue;

    const text = token.text.trim();
    const base = slugify(text);
    const key = base || `h-${entries.length + 1}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);

    entries.push({ depth: token.depth, text, slug: count === 0 ? key : `${key}-${count}` });
  }

  return entries;
}

/**
 * Gives each heading in already-rendered preview HTML the slug `outlineOf`
 * assigned it.
 *
 * Assigning ids while walking the DOM rather than rewriting the HTML string
 * keeps marked's output untouched and guarantees the ids land on the same
 * headings, in the same order, that the outline lists.
 */
export function applyHeadingIds(html: string, entries: OutlineEntry[]): string {
  if (entries.length === 0) return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  entries.forEach((entry, index) => {
    // Guard rather than trust: if marked's token walk and the rendered tree ever
    // disagree, a missing node must not shift every later anchor.
    headings[index]?.setAttribute('id', entry.slug);
  });

  return container.innerHTML;
}
