import { useState, useEffect, useCallback } from 'react';
import { mcpApi } from '@/lib/api';

type TimeWindow = '1h' | '24h' | '7d';

interface AgentMetric {
  agentId: string;
  calls: number;
  errors: number;
  cost: number;
  avgLatency: number;
}

interface ToolMetric {
  tool: string;
  calls: number;
  errors: number;
}

interface Totals {
  calls: number;
  cost: number;
  avgLatency: number;
}

interface MetricsData {
  totals: Totals;
  perAgent: AgentMetric[];
  perTool: ToolMetric[];
}

interface AuditEntry {
  timestamp: string;
  agentId: string;
  tool: string;
  outcome: 'allowed' | 'denied' | 'error';
}

const outcomeBadge: Record<string, string> = {
  allowed: 'bg-[rgba(46,204,140,0.15)] text-[hsl(var(--aep-success))] border border-[rgba(46,204,140,0.3)]',
  denied:  'bg-[rgba(255,80,80,0.15)] text-red-400 border border-[rgba(255,80,80,0.3)]',
  error:   'bg-[rgba(255,200,50,0.15)] text-yellow-400 border border-[rgba(255,200,50,0.3)]',
};

const MCPMetricsPanel = () => {
  const [window, setWindow] = useState<TimeWindow>('24h');
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (w: TimeWindow) => {
    try {
      const [metricsRes, auditRes] = await Promise.all([
        mcpApi.metrics(w),
        mcpApi.audit({ limit: 10 }),
      ]);
      
      const metricsData = metricsRes.data?.data ?? metricsRes.data ?? null;
      const auditData = auditRes.data?.data ?? auditRes.data ?? [];
      
      // Ensure arrays are valid
      if (metricsData && !Array.isArray(metricsData.perAgent)) {
        console.error('Expected perAgent to be array, got:', metricsData.perAgent);
        metricsData.perAgent = [];
      }
      if (metricsData && !Array.isArray(metricsData.perTool)) {
        console.error('Expected perTool to be array, got:', metricsData.perTool);
        metricsData.perTool = [];
      }
      if (!Array.isArray(auditData)) {
        console.error('Expected audit to be array, got:', auditData);
        setAudit([]);
      } else {
        setAudit(auditData);
      }
      
      setMetrics(metricsData);
      setError(null);
    } catch (_) {
      setError('Gateway unavailable — metrics will appear once the MCP gateway is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData(window);
    const id = setInterval(() => fetchData(window), 10_000);
    return () => clearInterval(id);
  }, [window, fetchData]);

  const totals = metrics?.totals;
  const perAgent = metrics?.perAgent ?? [];
  const perTool = metrics?.perTool ?? [];

  return (
    <div className="bg-[hsl(var(--aep-panel))] border border-border rounded-sm p-6 mb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="font-['Syne'] font-bold text-[11px] tracking-[0.12em] uppercase text-muted-foreground flex items-center gap-2">
          <span>🛡️</span>
          <span>MCP Agent Gateway</span>
        </div>
        <div className="flex gap-1">
          {(['1h', '24h', '7d'] as TimeWindow[]).map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`text-[10px] px-2 py-0.5 rounded-sm border tracking-[0.08em] uppercase transition-colors ${
                window === w
                  ? 'bg-[hsl(var(--aep-gold))] text-black border-[hsl(var(--aep-gold))]'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-[11px] text-muted-foreground">Loading...</div>
      ) : error ? (
        <div className="text-[11px] text-yellow-400 bg-[rgba(255,200,50,0.08)] border border-[rgba(255,200,50,0.2)] rounded-sm p-3">
          {error}
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Calls', value: totals?.calls ?? '—' },
              { label: 'Total Cost (USD)', value: totals?.cost != null ? `$${totals.cost.toFixed(4)}` : '—' },
              { label: 'Avg Latency (ms)', value: totals?.avgLatency != null ? `${totals.avgLatency.toFixed(0)}ms` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[rgba(255,255,255,0.03)] border border-border rounded-sm p-3">
                <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">{label}</div>
                <div className="font-['Syne'] font-bold text-[18px] text-[hsl(var(--aep-gold))]">{String(value)}</div>
              </div>
            ))}
          </div>

          {/* Per-agent table */}
          <div className="mb-6">
            <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-2">Per Agent</div>
            {perAgent.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">No agent data.</div>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    {['Agent', 'Calls', 'Errors', 'Cost (USD)', 'Avg Latency'].map((h) => (
                      <th key={h} className="text-left py-1.5 pr-4 font-normal tracking-[0.06em] uppercase text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perAgent.map((row) => (
                    <tr key={row.agentId} className="border-b border-border/40 hover:bg-[rgba(255,255,255,0.02)]">
                      <td className="py-1.5 pr-4 text-foreground">{row.agentId}</td>
                      <td className="py-1.5 pr-4">{row.calls}</td>
                      <td className="py-1.5 pr-4 text-red-400">{row.errors}</td>
                      <td className="py-1.5 pr-4 text-[hsl(var(--aep-gold))]">${row.cost.toFixed(4)}</td>
                      <td className="py-1.5">{row.avgLatency.toFixed(0)}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Per-tool table */}
          <div className="mb-6">
            <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-2">Per Tool</div>
            {perTool.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">No tool data.</div>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    {['Tool', 'Calls', 'Errors'].map((h) => (
                      <th key={h} className="text-left py-1.5 pr-4 font-normal tracking-[0.06em] uppercase text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perTool.map((row) => (
                    <tr key={row.tool} className="border-b border-border/40 hover:bg-[rgba(255,255,255,0.02)]">
                      <td className="py-1.5 pr-4 text-foreground">{row.tool}</td>
                      <td className="py-1.5 pr-4">{row.calls}</td>
                      <td className="py-1.5 text-red-400">{row.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Audit log */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-2">Recent Audit Log</div>
            {audit.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">No audit entries.</div>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    {['Time', 'Agent', 'Tool', 'Outcome'].map((h) => (
                      <th key={h} className="text-left py-1.5 pr-4 font-normal tracking-[0.06em] uppercase text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.map((entry, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-[rgba(255,255,255,0.02)]">
                      <td className="py-1.5 pr-4 text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-1.5 pr-4 text-foreground">{entry.agentId}</td>
                      <td className="py-1.5 pr-4">{entry.tool}</td>
                      <td className="py-1.5">
                        <span className={`text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-sm ${outcomeBadge[entry.outcome] ?? outcomeBadge.error}`}>
                          {entry.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MCPMetricsPanel;
