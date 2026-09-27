import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { Tabs } from '../components/ui/Tabs';
import { api } from '../services/api';
import { formatDistanceToNow } from '../utils/format';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  read: boolean;
  createdAt: string;
}

type Filter = 'all' | 'unread';

export function Notifications() {
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const fetchNotifications = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const res = (await api.get('/notifications', {
        params: { limit: 50, unreadOnly: f === 'unread' },
      })) as unknown as { success: boolean; data: { items: NotificationItem[] } };
      if (res.success) setItems(res.data.items);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(filter);
  }, [fetchNotifications, filter]);

  const handleMarkRead = async (id: string) => {
    setActing(true);
    try {
      await api.post(`/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    } finally {
      setActing(false);
    }
  };

  const handleReadAll = async () => {
    setActing(true);
    try {
      await api.post('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setActing(false);
    }
  };

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
        actions={
          <>
            <Tabs
              options={[
                { id: 'all', label: 'All' },
                { id: 'unread', label: 'Unread' },
              ]}
              value={filter}
              onChange={setFilter}
              ariaLabel="Notification filter"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReadAll}
              disabled={acting || unreadCount === 0}
            >
              <CheckCheck className="w-4 h-4" aria-hidden="true" /> Mark all read
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" label="Loading notifications" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={filter === 'unread' ? BellOff : Bell}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            description={
              filter === 'unread'
                ? 'Everything has been read.'
                : 'System events and mentions will appear here.'
            }
          />
        ) : (
          <ul className="max-w-3xl mx-auto space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className={`flex items-start gap-3 px-4 py-3 border border-border rounded-lg bg-bg-elevated ${item.read ? 'opacity-70' : ''}`}
              >
                <Bell className="w-5 h-5 text-fg-muted flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-fg truncate">{item.title}</p>
                    {!item.read && <Badge variant="default">New</Badge>}
                  </div>
                  {item.message && <p className="text-sm text-fg-muted mt-0.5">{item.message}</p>}
                  <p className="text-xs text-fg-subtle mt-1">
                    {item.type} · {formatDistanceToNow(item.createdAt)}
                  </p>
                </div>
                {!item.read && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleMarkRead(item.id)}
                    disabled={acting}
                  >
                    Mark read
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
