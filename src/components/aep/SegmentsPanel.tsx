import type { SegmentData } from '@/types/aep';

interface Props {
  segments: SegmentData[];
}

const SegmentsPanel = ({ segments }: Props) => (
  <div className="bg-[hsl(var(--aep-panel))] border border-border rounded-sm p-6">
    <div className="font-['Syne'] font-bold text-[11px] tracking-[0.12em] uppercase text-muted-foreground mb-5 flex items-center justify-between">
      <span>Audience Segments —</span>
    </div>
    <div className="flex flex-col gap-2.5">
      {segments.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">Awaiting Audience Agent...</div>
      ) : (
        segments.map((s) => (
          <div key={s.name} className="segment-item">
            <span className="text-foreground">{s.name}</span>
            <span className="font-['Syne'] font-bold text-[13px] text-[hsl(var(--aep-gold))]">{s.size}</span>
            <span className="text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-sm bg-[rgba(46,204,140,0.1)] text-[hsl(var(--aep-success))] border border-[rgba(46,204,140,0.2)]">
              {s.tag}
            </span>
          </div>
        ))
      )}
    </div>
  </div>
);

export default SegmentsPanel;
