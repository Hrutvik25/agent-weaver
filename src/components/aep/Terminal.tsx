import { useEffect, useRef } from 'react';
import type { LogEntry } from '@/types/aep';

interface Props {
  logs: LogEntry[];
}

const Terminal = ({ logs }: Props) => {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-[hsl(var(--aep-panel))] border border-border rounded-sm mb-12">
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 text-[11px] text-muted-foreground">
        <div className="terminal-dots flex gap-1.5">
          <span className="t-red" />
          <span className="t-yellow" />
          <span className="t-green" />
        </div>
        aep-orchestrator · agent-log
      </div>
      <div ref={bodyRef} className="p-5 h-[220px] overflow-y-auto text-[12px] leading-[2]">
        {logs.map((log, i) => (
          <div key={i} className="log-line">
            <span className="text-muted-foreground min-w-[80px]">{log.time}</span>
            <span className={`log-tag min-w-[120px] font-medium ${log.tagClass}`}>{log.tag}</span>
            <span className="text-foreground">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Terminal;
