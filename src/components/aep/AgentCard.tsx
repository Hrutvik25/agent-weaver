import type { AgentData } from '@/types/aep';

interface Props {
  agent: AgentData;
}

const statusClass = (s: string) => {
  if (s === 'running') return 'text-[hsl(var(--aep-gold))] border border-[rgba(232,168,56,0.3)] bg-[rgba(232,168,56,0.08)]';
  if (s === 'done') return 'text-[hsl(var(--aep-success))] border border-[rgba(46,204,140,0.3)] bg-[rgba(46,204,140,0.08)]';
  return 'text-muted-foreground border border-[rgba(107,107,122,0.3)]';
};

const colorClass = (c: string) => {
  if (c === 'red') return 'text-primary';
  if (c === 'gold') return 'text-[hsl(var(--aep-gold))]';
  if (c === 'green') return 'text-[hsl(var(--aep-success))]';
  if (c === 'cyan') return 'text-[hsl(var(--aep-cyan))]';
  return 'text-foreground';
};

const AgentCard = ({ agent }: Props) => (
  <div className={`agent-card ${agent.status === 'running' ? 'running' : ''} ${agent.status !== 'idle' ? 'active' : ''}`}>
    <div className="text-2xl mb-3.5">{agent.icon}</div>
    <div className="font-['Syne'] font-bold text-[13px] tracking-[0.05em] uppercase text-foreground mb-1.5">{agent.name}</div>
    <div className="text-[11px] text-muted-foreground leading-[1.7] mb-3.5">{agent.description}</div>
    <span className={`text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-sm inline-flex items-center gap-1.5 ${statusClass(agent.status)}`}>
      ● {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
    </span>
    <div className="mt-3.5 pt-3.5 border-t border-border grid grid-cols-2 gap-2">
      {agent.metrics.map((m) => (
        <div key={m.label} className="text-[10px] text-muted-foreground">
          <span className={`text-base font-medium font-['Syne'] block ${colorClass(m.color)}`}>{m.value}</span>
          {m.label}
        </div>
      ))}
    </div>
  </div>
);

export default AgentCard;
