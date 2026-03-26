import type { StreamEvent } from '@/types/aep';

interface Props {
  events: StreamEvent[];
}

const AnalyticsStreamPanel = ({ events }: Props) => (
  <div className="bg-[hsl(var(--aep-panel))] border border-border rounded-sm p-6">
    <div className="font-['Syne'] font-bold text-[11px] tracking-[0.12em] uppercase text-muted-foreground mb-5 flex items-center justify-between">
      <span>Adobe Analytics · Live Stream</span>
      <span className="text-primary">{events.length} events</span>
    </div>
    <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
      {events.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">Awaiting journey activation...</div>
      ) : (
        events.map((e, i) => (
          <div key={i} className="stream-item">
            <span className={`stream-event event-${e.eventType}`} />
            <span className="text-[hsl(var(--aep-cyan))] w-[90px] flex-shrink-0">{e.user}</span>
            <span className="text-foreground flex-1">{e.action}</span>
            <span className="text-muted-foreground text-[10px]">{e.time}</span>
          </div>
        ))
      )}
    </div>
  </div>
);

export default AnalyticsStreamPanel;
