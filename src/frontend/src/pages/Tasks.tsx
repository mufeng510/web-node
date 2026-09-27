import { ClipboardList, Cpu } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { Tabs } from '../components/ui/Tabs';
import { useLibraries } from '../hooks/useLibraries';
import { api } from '../services/api';
import { formatDistanceToNow } from '../utils/format';

type TaskTab = 'general' | 'agent';

interface GeneralTask {
  id: string;
  libraryId?: string | null;
  status: string;
  goal?: string | null;
  title?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface AgentTask {
  id: string;
  goal: string;
  status: string;
  libraryId?: string | null;
  createdAt: string;
}

const statusVariant = (status: string): 'default' | 'success' | 'destructive' | 'outline' => {
  if (status === 'completed' || status === 'success') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'destructive';
  if (status === 'running' || status === 'pending') return 'default';
  return 'outline';
};

export function Tasks() {
  const { libraries, currentLibrary } = useLibraries();
  const [tab, setTab] = useState<TaskTab>('general');
  const [statusFilter, setStatusFilter] = useState('');
  const [items, setItems] = useState<(GeneralTask | AgentTask)[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = tab === 'general' ? '/tasks' : '/ai/agent/tasks';
      const params: Record<string, string> = { limit: '50' };
      if (currentLibrary?.id) params.libraryId = currentLibrary.id;
      if (statusFilter) params.status = statusFilter;
      const res = (await api.get(endpoint, { params })) as unknown as {
        success: boolean;
        data: { items: (GeneralTask | AgentTask)[] };
      };
      if (res.success) setItems(res.data.items);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [tab, currentLibrary?.id, statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const titleOf = (t: GeneralTask | AgentTask) =>
    ('title' in t && t.title) || ('goal' in t && t.goal) || t.id;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Tasks"
        description={
          tab === 'agent'
            ? 'AI agent tasks (read-only: no executor is running)'
            : 'Background tasks across your libraries'
        }
        actions={
          <>
            <Tabs
              options={[
                { id: 'general', label: 'General', icon: ClipboardList },
                { id: 'agent', label: 'Agent', icon: Cpu },
              ]}
              value={tab}
              onChange={setTab}
              ariaLabel="Task type"
            />
            <div className="w-36 flex-shrink-0">
              <Select
                aria-label="Status filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'All statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'running', label: 'Running' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'failed', label: 'Failed' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
            </div>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" label="Loading tasks" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={tab === 'agent' ? Cpu : ClipboardList}
            title="No tasks"
            description={
              tab === 'agent'
                ? 'No AI agent tasks yet. The agent executor is not running, so new tasks cannot be started from the UI.'
                : currentLibrary
                  ? `No tasks in ${currentLibrary.name}.`
                  : 'No tasks found.'
            }
          />
        ) : (
          <ul className="max-w-3xl mx-auto space-y-2">
            {items.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 px-4 py-3 border border-border rounded-lg bg-bg-elevated"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg truncate">{titleOf(task)}</p>
                  <p className="text-xs text-fg-subtle mt-0.5">
                    {task.libraryId
                      ? `${libraries.find((l) => l.id === task.libraryId)?.name ?? 'Library'} · `
                      : ''}
                    {formatDistanceToNow(task.createdAt)}
                  </p>
                </div>
                <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
