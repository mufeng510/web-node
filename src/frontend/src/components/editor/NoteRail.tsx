import { useTranslation } from '../../hooks/useTranslation';
import type { OutlineEntry } from '../../lib/markdownOutline';
import { Spinner } from '../ui/Spinner';
import { AiRailPanel } from './AiRailPanel';
import { OutlinePanel } from './OutlinePanel';

export interface Backlink {
  sourcePath: string;
  sourceName: string;
  type: string;
  target: string;
}

export interface NoteRailProps {
  libraryId: string;
  notePath: string;
  entries: OutlineEntry[];
  backlinks: Backlink[];
  loading: boolean;
  onOpenNote: (path: string) => void;
}

const TYPE_LABEL: Record<string, string> = {
  wikilink: 'editor.type.wikilink',
  embed: 'editor.type.embed',
  'markdown-link': 'editor.type.markdownLink',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border last:border-b-0">
      <h2 className="px-4 pt-4 pb-2 text-xs font-medium uppercase tracking-wider text-fg-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The docked panel for an open note: its outline, then the notes pointing at it.
 *
 * Both sections read from state the editor already owns, so the rail never
 * fetches on its own and cannot show a note's data while the note is loading.
 */
export function NoteRail({
  libraryId,
  notePath,
  entries,
  backlinks,
  loading,
  onOpenNote,
}: NoteRailProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Section title={t('editor.rail.outline')}>
        <OutlinePanel entries={entries} />
      </Section>

      <Section title={t('editor.rail.backlinks')}>
        {loading ? (
          <div className="px-4 pb-4">
            <Spinner size="sm" label={t('editor.rail.loadingBacklinks')} />
          </div>
        ) : backlinks.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-fg-muted">{t('editor.rail.noBacklinks')}</p>
        ) : (
          <ul className="px-2 pb-3">
            {backlinks.map((link) => (
              <li key={`${link.sourcePath}:${link.target}`}>
                <button
                  type="button"
                  onClick={() => onOpenNote(link.sourcePath)}
                  title={link.sourcePath}
                  className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate text-sm text-fg">{link.sourceName}</span>
                  <span className="ml-auto shrink-0 text-xs text-fg-subtle">
                    {t(TYPE_LABEL[link.type] ?? 'editor.type.markdownLink')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {notePath === '' && (
          <p className="px-4 pb-4 text-sm text-fg-muted">{t('editor.rail.saveFirst')}</p>
        )}
      </Section>

      {notePath !== '' && (
        <section className="flex min-h-0 flex-1 flex-col border-t border-border">
          <h2 className="shrink-0 px-4 pt-4 pb-2 text-xs font-medium uppercase tracking-wider text-fg-muted">
            {t('editor.rail.ask')}
          </h2>
          <AiRailPanel libraryId={libraryId} notePath={notePath} />
        </section>
      )}
    </div>
  );
}
