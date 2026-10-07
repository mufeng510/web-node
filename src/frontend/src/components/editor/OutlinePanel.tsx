import type { OutlineEntry } from '../../lib/markdownOutline';
import { cn } from '../../lib/utils';

export interface OutlinePanelProps {
  entries: OutlineEntry[];
  onNavigate?: () => void;
}

/**
 * Headings of the open note, linking to their anchors in the preview.
 *
 * Slugs come from `outlineOf`, the same source the preview's heading ids are
 * assigned from, so an entry always targets the heading it names.
 */
export function OutlinePanel({ entries, onNavigate }: OutlinePanelProps) {
  if (entries.length === 0) {
    return (
      <div className="p-4 text-sm text-fg-muted">
        这篇笔记还没有标题，大纲会在你添加标题后出现。
      </div>
    );
  }

  return (
    <nav aria-label="笔记大纲" className="p-2">
      <ul className="space-y-0.5">
        {entries.map((entry) => (
          <li key={entry.slug}>
            <a
              href={`#${entry.slug}`}
              onClick={onNavigate}
              style={{ paddingLeft: `${(entry.depth - 1) * 12 + 8}px` }}
              className={cn(
                'block truncate rounded-md py-1 pr-2 text-sm transition-colors duration-150',
                'text-fg-muted hover:bg-bg-hover hover:text-fg',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                entry.depth === 1 && 'font-medium text-fg'
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
