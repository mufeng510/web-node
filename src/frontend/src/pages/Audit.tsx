import { ScrollText } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { api } from '../services/api';
import { formatDistanceToNow } from '../utils/format';

interface AuditItem {
  id: string;
  userId?: string | null;
  libraryId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export function Audit() {
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();

  const fetchAudit = useCallback(
    async (cursor?: string) => {
      if (!cursor) setLoading(true);
      try {
        const params: Record<string, string> = { limit: '50' };
        if (action.trim()) params.action = action.trim();
        if (resourceType.trim()) params.resourceType = resourceType.trim();
        if (cursor) params.cursor = cursor;
        const res = (await api.get('/audit', { params })) as unknown as {
          success: boolean;
          data: { items: AuditItem[]; nextCursor?: string; hasMore: boolean };
        };
        if (res.success) {
          setItems((prev) => (cursor ? [...prev, ...res.data.items] : res.data.items));
          setNextCursor(res.data.nextCursor);
          setHasMore(res.data.hasMore);
        }
      } catch (error) {
        console.error('Failed to load audit logs:', error);
      } finally {
        setLoading(false);
      }
    },
    [action, resourceType]
  );

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader title="Audit Log" description="Security-relevant actions across the system" />

      <form
        className="flex flex-col sm:flex-row gap-2 p-4 border-b border-border"
        onSubmit={(e) => {
          e.preventDefault();
          setItems([]);
          setNextCursor(undefined);
          fetchAudit();
        }}
      >
        <div className="flex-1 min-w-0">
          <Input
            aria-label="Filter by action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Filter by action (e.g. auth.login)"
          />
        </div>
        <div className="flex-1 min-w-0">
          <Input
            aria-label="Filter by resource type"
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            placeholder="Filter by resource type (e.g. file)"
          />
        </div>
        <Button type="submit" disabled={loading}>
          Apply
        </Button>
      </form>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" label="Loading audit logs" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No audit events"
            description="No events match the current filters."
          />
        ) : (
          <div className="max-w-4xl mx-auto space-y-2">
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="px-4 py-3 border border-border rounded-lg bg-bg-elevated"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{item.action}</Badge>
                    {item.resourceType && (
                      <span className="text-xs text-fg-muted">
                        {item.resourceType}
                        {item.resourceId ? ` · ${item.resourceId.slice(0, 8)}` : ''}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-fg-subtle">
                      {formatDistanceToNow(item.createdAt)}
                    </span>
                  </div>
                  {(item.ip || item.userAgent) && (
                    <p className="text-xs text-fg-subtle mt-1 truncate">
                      {item.ip || ''} {item.userAgent ? `· ${item.userAgent}` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {hasMore && nextCursor && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="secondary"
                  onClick={() => fetchAudit(nextCursor)}
                  disabled={loading}
                >
                  {loading ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
