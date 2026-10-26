import { ClipboardList, Cpu } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { ContentShell } from '../components/ui/ContentShell';
import { EmptyState } from '../components/ui/EmptyState';
import { PageContextBar } from '../components/ui/PageContextBar';
import { ScrollArea } from '../components/ui/ScrollArea';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { Tabs } from '../components/ui/Tabs';
import { useLibraries } from '../hooks/useLibraries';
import { useTranslation } from '../hooks/useTranslation';
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
  const { t } = useTranslation();
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
      <PageContextBar
        title={t('pages.tasks.title')}
        detail={tab === 'agent' ? t('pages.tasks.detailAgent') : t('pages.tasks.detailGeneral')}
        className="border-b-0"
      />
      {/* Tab and status controls are view state, not actions, so they stay in the
          header band instead of moving into the bar's actions array. */}
      <div className="border-b border-border px-4 py-2 lg:px-6">
        <div className="mx-auto w-full max-w-[var(--content-max-w)] flex flex-wrap items-center gap-2">
          <Tabs
            options={[
              { id: 'general', label: t('pages.tasks.tabGeneral'), icon: ClipboardList },
              { id: 'agent', label: t('pages.tasks.tabAgent'), icon: Cpu },
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel={t('pages.tasks.ariaTaskType')}
          />
          <div className="w-36 flex-shrink-0">
            <Select
              aria-label={t('pages.tasks.ariaStatusFilter')}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: t('pages.tasks.filterAllStatuses') },
                { value: 'pending', label: t('pages.tasks.filterPending') },
                { value: 'running', label: t('pages.tasks.filterRunning') },
                { value: 'completed', label: t('pages.tasks.filterCompleted') },
                { value: 'failed', label: t('pages.tasks.filterFailed') },
                { value: 'cancelled', label: t('pages.tasks.filterCancelled') },
              ]}
            />
          </div>
        </div>
      </div>

      <ScrollArea className="p-4">
        <ContentShell>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" label={t('pages.tasks.spinnerLoadingTasks')} />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={tab === 'agent' ? Cpu : ClipboardList}
              title={t('pages.tasks.emptyNoTasks')}
              description={
                tab === 'agent'
                  ? t('pages.tasks.emptyNoAgentTasks')
                  : currentLibrary
                    ? t('pages.tasks.emptyNoTasksInLibrary', { name: currentLibrary.name })
                    : t('pages.tasks.emptyNoTasksFound')
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
                        ? `${libraries.find((l) => l.id === task.libraryId)?.name ?? t('common.library')} · `
                        : ''}
                      {formatDistanceToNow(task.createdAt)}
                    </p>
                  </div>
                  <Badge variant={statusVariant(task.status)}>
                    {t(`pages.tasks.status.${task.status}`) ?? task.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </ContentShell>
      </ScrollArea>
    </div>
  );
}
