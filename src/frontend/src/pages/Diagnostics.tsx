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
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
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
      <div className="flex-1 flex items-center justify-center text-fg-muted">
        Loading diagnostics...
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-fg">Diagnostics</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={fetchHealth} className="btn-secondary btn-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              fetchExport();
              setShowExport(true);
            }}
            className="btn-secondary btn-sm"
          >
            <Wrench className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DiagnosticCard
          title="Overall Health"
          value={health?.healthy ? 'Healthy' : 'Unhealthy'}
          icon={health?.healthy ? CheckCircle : AlertCircle}
          iconColor={health?.healthy ? 'text-success' : 'text-destructive'}
          details={Object.entries(health?.checks || {}).map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="capitalize text-fg-muted">{k.replace(/_/g, ' ')}</span>
              <span className={v ? 'text-success' : 'text-destructive'}>{v ? '✓' : '✗'}</span>
            </div>
          ))}
        />
        <DiagnosticCard
          title="Database"
          value={formatBytes(status?.database?.size || 0)}
          icon={Database}
          iconColor="text-primary"
          details={Object.entries(status?.database?.tables || {}).map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="capitalize text-fg-muted">{k}</span>
              <span className="text-fg">{v}</span>
            </div>
          ))}
        />
        <DiagnosticCard
          title="Storage"
          value={`${status?.storage?.dataRoot} / ${status?.storage?.appDataRoot}`}
          icon={HardDrive}
          iconColor="text-amber-500"
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
        <DiagnosticCard
          title="System"
          value={formatUptime(status?.uptime || 0)}
          icon={Server}
          iconColor="text-purple-500"
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
        <div className="card p-4">
          <h3 className="font-medium text-fg mb-3 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-fg-muted" /> Git Status
          </h3>
          <div className="text-sm text-fg-muted">Git integration status will appear here</div>
        </div>

        <div className="card p-4">
          <h3 className="font-medium text-fg mb-3 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-fg-muted" /> AI Services
          </h3>
          <div className="text-sm text-fg-muted">AI provider status will appear here</div>
        </div>
      </div>

      {showExport && exportData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-fg">Diagnostics Export</h2>
              <button type="button" onClick={() => setShowExport(false)} className="btn-ghost p-1">
                <X className="w-5 h-5 text-fg-muted" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-bg">
              <pre className="text-fg">{JSON.stringify(exportData, null, 2)}</pre>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button type="button" onClick={() => setShowExport(false)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosticCard({
  title,
  value,
  icon: Icon,
  iconColor,
  details,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  details?: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-fg-muted">{title}</p>
          <p className="text-xl font-semibold text-fg mt-1">{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${iconColor}`} />
      </div>
      {details && <div className="mt-3 pt-3 border-t border-border space-y-1">{details}</div>}
    </div>
  );
}
