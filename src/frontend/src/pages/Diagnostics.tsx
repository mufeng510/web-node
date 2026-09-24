import {
  AlertCircle,
  BrainCircuit,
  CheckCircle,
  Database,
  GitBranch,
  HardDrive,
  RefreshCw,
  Server,
  Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { StatCard } from '../components/ui/StatCard';
import { useLibraries } from '../hooks/useLibraries';
import { api } from '../services/api';

interface HealthCheck {
  healthy: boolean;
  checks: Record<string, boolean>;
  timestamp: string;
}

interface StatusData {
  version: string;
  environment: string;
  database: { size: number; tables: Record<string, number> };
  storage: { dataRoot: string; appDataRoot: string };
  uptime: number;
  memory: NodeJS.MemoryUsage;
}

export function Diagnostics() {
  const { currentLibrary } = useLibraries();
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportData, setExportData] = useState<unknown>(null);
  const [showExport, setShowExport] = useState(false);
  const [gitInfo, setGitInfo] = useState<{
    branch: string;
    clean: boolean;
    changed: number;
  } | null>(null);
  const [gitMessage, setGitMessage] = useState<string | null>(null);
  const [providers, setProviders] = useState<{ id: string; name: string; type: string }[] | null>(
    null
  );

  const fetchHealth = async () => {
    try {
      const [healthRes, statusRes] = await Promise.all([
        api.get('/diagnostics/health'),
        api.get('/diagnostics/status'),
      ]);
      if (healthRes.success) setHealth(healthRes.data);
      if (statusRes.success) setStatus(statusRes.data);
    } catch (error) {
      console.error('Failed to fetch diagnostics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExport = async () => {
    try {
      const res = await api.get('/diagnostics/export');
      if (res.success) setExportData(res.data);
    } catch (error) {
      console.error('Failed to export diagnostics:', error);
    }
  };

  const fetchIntegrations = async (libraryId?: string) => {
    setGitInfo(null);
    setGitMessage(null);
    setProviders(null);
    if (libraryId) {
      try {
        const res = (await api.get(`/git/${libraryId}/status`)) as unknown as {
          success: boolean;
          data: { status: { current: string | null; files: unknown[] } };
        };
        if (res.success) {
          const files = res.data.status.files || [];
          setGitInfo({
            branch: res.data.status.current || 'detached',
            clean: files.length === 0,
            changed: files.length,
          });
        }
      } catch {
        setGitMessage('Not a git repository or git unavailable');
      }
    } else {
      setGitMessage('Select a library to view git status');
    }
    try {
      const res = (await api.get('/ai/providers')) as unknown as {
        success: boolean;
        data: { id: string; name: string; type: string }[];
      };
      if (res.success) setProviders(res.data);
    } catch (error) {
      console.error('Failed to fetch AI providers:', error);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchHealth();
    fetchIntegrations(currentLibrary?.id);
  };

  useEffect(() => {
    fetchHealth();
    fetchIntegrations(currentLibrary?.id);
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [currentLibrary?.id]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-fg-muted">
        <Spinner label="Loading diagnostics" />
        <span>Loading diagnostics...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Diagnostics"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4" aria-hidden="true" /> Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                fetchExport();
                setShowExport(true);
              }}
            >
              <Wrench className="w-4 h-4" aria-hidden="true" /> Export
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Overall Health"
            value={health?.healthy ? 'Healthy' : 'Unhealthy'}
            icon={health?.healthy ? CheckCircle : AlertCircle}
            iconClassName={health?.healthy ? 'text-success' : 'text-destructive'}
            details={Object.entries(health?.checks || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="capitalize text-fg-muted">{k.replace(/_/g, ' ')}</span>
                <Badge variant={v ? 'success' : 'destructive'}>{v ? 'OK' : 'Failed'}</Badge>
              </div>
            ))}
          />
          <StatCard
            title="Database"
            value={formatBytes(status?.database?.size || 0)}
            icon={Database}
            iconClassName="text-primary"
            details={Object.entries(status?.database?.tables || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="capitalize text-fg-muted">{k}</span>
                <span className="text-fg">{v}</span>
              </div>
            ))}
          />
          <StatCard
            title="Storage"
            value={`${status?.storage?.dataRoot} / ${status?.storage?.appDataRoot}`}
            icon={HardDrive}
            details={[
              <div key="data" className="flex justify-between text-xs">
                <span className="text-fg-muted">Data Root</span>
                <span className="text-fg">{status?.storage?.dataRoot}</span>
              </div>,
              <div key="app" className="flex justify-between text-xs">
                <span className="text-fg-muted">App Data Root</span>
                <span className="text-fg">{status?.storage?.appDataRoot}</span>
              </div>,
            ]}
          />
          <StatCard
            title="System"
            value={formatUptime(status?.uptime || 0)}
            icon={Server}
            details={[
              <div key="mem" className="flex justify-between text-xs">
                <span className="text-fg-muted">Memory</span>
                <span className="text-fg">
                  {formatBytes(status?.memory?.heapUsed || 0)} /{' '}
                  {formatBytes(status?.memory?.heapTotal || 0)}
                </span>
              </div>,
              <div key="env" className="flex justify-between text-xs">
                <span className="text-fg-muted">Environment</span>
                <span className="text-fg">{status?.environment}</span>
              </div>,
              <div key="ver" className="flex justify-between text-xs">
                <span className="text-fg-muted">Version</span>
                <span className="text-fg">{status?.version}</span>
              </div>,
            ]}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-fg-muted" aria-hidden="true" /> Git Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gitInfo ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-fg-muted">Branch</span>
                    <span className="text-fg">{gitInfo.branch}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-fg-muted">Working tree</span>
                    <Badge variant={gitInfo.clean ? 'success' : 'destructive'}>
                      {gitInfo.clean ? 'Clean' : `${gitInfo.changed} changed`}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fg-muted">Library</span>
                    <span className="text-fg truncate max-w-[160px]">{currentLibrary?.name}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-fg-muted">{gitMessage || 'Loading...'}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-fg-muted" aria-hidden="true" /> AI Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              {providers === null ? (
                <div className="text-sm text-fg-muted">Loading...</div>
              ) : providers.length === 0 ? (
                <div className="text-sm text-fg-muted">No AI providers configured</div>
              ) : (
                <div className="space-y-2 text-sm">
                  {providers.map((p) => (
                    <div key={p.id} className="flex justify-between">
                      <span className="text-fg truncate max-w-[160px]">{p.name}</span>
                      <Badge variant="success">{p.type}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Diagnostics Export</DialogTitle>
          </DialogHeader>
          <div className="p-0">
            <div className="max-h-[50vh] overflow-auto p-4 font-mono text-xs bg-bg">
              <pre className="text-fg">{JSON.stringify(exportData, null, 2)}</pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowExport(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
