import { FileText, Search as SearchIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ContentShell } from '../components/ui/ContentShell';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageContextBar } from '../components/ui/PageContextBar';
import { ScrollArea } from '../components/ui/ScrollArea';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { Tabs } from '../components/ui/Tabs';
import { useLibraries } from '../hooks/useLibraries';
import { useTranslation } from '../hooks/useTranslation';
import { routes } from '../routes';
import { api } from '../services/api';

type SearchScope = 'all' | 'filename' | 'content';

interface SearchItem {
  id: string;
  libraryId?: string;
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  mimeType: string | null;
  mtime: string;
}

export function Search() {
  const { t } = useTranslation();
  const scopeOptions = [
    { id: 'all', label: t('pages.search.scopeAll') },
    { id: 'filename', label: t('pages.search.scopeFilename') },
    { id: 'content', label: t('pages.search.scopeContent') },
  ] as const;
  const { libraries, currentLibrary } = useLibraries();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialQ = params.get('q') ?? '';
  const initialScope = (params.get('scope') as SearchScope) || 'all';

  const [query, setQuery] = useState(initialQ);
  const [scope, setScope] = useState<SearchScope>(
    ['all', 'filename', 'content'].includes(initialScope) ? initialScope : 'all'
  );
  const [libraryId, setLibraryId] = useState<string>(currentLibrary?.id ?? '');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(
    async (q: string, s: SearchScope, libId: string) => {
      const term = q.trim();
      if (!term) {
        setItems([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      try {
        const endpoint = libId ? `/search/${libId}` : '/search/global';
        const res = (await api.get(endpoint, {
          params: { q: term, scope: s, limit: 50 },
        })) as unknown as {
          success: boolean;
          data: { items: SearchItem[] };
        };
        if (res.success) {
          setItems(res.data.items);
          setSearched(true);
          setParams({ q: term, scope: s }, { replace: true });
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    },
    [setParams]
  );

  useEffect(() => {
    if (initialQ.trim()) {
      runSearch(initialQ, initialScope, currentLibrary?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query, scope, libraryId);
  };

  const libraryName = (id?: string) => libraries.find((l) => l.id === id)?.name ?? 'Library';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageContextBar title={t('pages.search.title')} detail={t('pages.search.detail')} />

      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-2 p-4 border-b border-border"
        aria-label={t('pages.search.ariaSearchNotes')}
      >
        <div className="flex-1 min-w-0">
          <Input
            aria-label={t('pages.search.ariaSearchQuery')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('pages.search.placeholder')}
            leadingIcon={<SearchIcon className="w-5 h-5" aria-hidden="true" />}
          />
        </div>
        <div className="flex gap-2">
          <Tabs
            options={scopeOptions.map((o) => ({ ...o }))}
            value={scope}
            onChange={setScope}
            ariaLabel={t('pages.search.ariaSearchScope')}
          />
          <div className="w-40 flex-shrink-0">
            <Select
              aria-label={t('pages.search.ariaLibrary')}
              value={libraryId}
              onChange={(e) => setLibraryId(e.target.value)}
              options={[
                { value: '', label: t('pages.search.selectAllLibraries') },
                ...libraries.map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? t('pages.search.btnSearching') : t('pages.search.btnSearch')}
          </Button>
        </div>
      </form>

      <ScrollArea className="p-4">
        <ContentShell>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" label={t('pages.search.spinnerSearching')} />
            </div>
          ) : !searched ? (
            <EmptyState
              icon={SearchIcon}
              title={t('pages.search.emptyTitle')}
              description={t('pages.search.emptyDescription')}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={SearchIcon}
              title={t('pages.search.emptyNoResults')}
              description={t('pages.search.emptyNoResultsDescription', { query })}
            />
          ) : (
            <ul className="max-w-3xl mx-auto divide-y divide-border border border-border rounded-lg overflow-hidden">
              {items.map((item) => (
                <li key={`${item.libraryId ?? ''}:${item.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      const lib = item.libraryId || libraryId || currentLibrary?.id;
                      if (lib && !item.isDir) navigate(routes.editor(lib, item.path));
                    }}
                    disabled={item.isDir}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default"
                  >
                    <FileText className="w-5 h-5 text-fg-muted flex-shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">
                        {item.name}
                      </span>
                      <span className="block truncate text-xs text-fg-muted">{item.path}</span>
                    </span>
                    {item.libraryId && item.libraryId !== currentLibrary?.id && (
                      <Badge variant="outline">{libraryName(item.libraryId)}</Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="max-w-3xl mx-auto mt-3 text-xs text-fg-subtle">
            {t('pages.search.tip')}{' '}
            <Link to={routes.home} className="text-primary hover:underline">
              {t('pages.search.linkBackToDashboard')}
            </Link>
          </p>
        </ContentShell>
      </ScrollArea>
    </div>
  );
}
