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
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportData, setExportData] = useState<unknown>(null);
  const [showExport, setShowExport] = useState(false);

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

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

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
            <Button variant="secondary" size="sm" onClick={fetchHealth}>
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
              <div className="text-sm text-fg-muted">Git integration status will appear here</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-fg-muted" aria-hidden="true" /> AI Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-fg-muted">AI provider status will appear here</div>
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
