import type { AgentData } from '@/types/aep';
import AgentCard from './AgentCard';

interface Props {
  agents: AgentData[];
}

const Pipeline = ({ agents }: Props) => (
  <>
    <div className="flex items-center gap-3 text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-5">
      Agent Pipeline
      <span className="flex-1 h-px bg-border" />
    </div>
    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-start mb-12">
      {agents.map((agent, i) => (
        <div key={agent.id} className="contents">
          <AgentCard agent={agent} />
          {i < agents.length - 1 && (
            <div className="flex items-center justify-center pt-10 text-primary text-xl opacity-50">→</div>
          )}
        </div>
      ))}
    </div>
  </>
);

export default Pipeline;
