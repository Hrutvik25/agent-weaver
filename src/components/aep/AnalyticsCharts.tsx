import type { ChartRow } from '@/types/aep';

interface Props {
  channelData: ChartRow[];
  conversionData: ChartRow[];
  sparkline: number[];
}

const AnalyticsCharts = ({ channelData, conversionData, sparkline }: Props) => (
  <div className="bg-[hsl(var(--aep-panel))] border border-border rounded-sm p-6 mb-12">
    <div className="font-['Syne'] font-bold text-[11px] tracking-[0.12em] uppercase text-muted-foreground mb-5">
      Adobe Analytics — Campaign Performance
    </div>
    <div className="grid grid-cols-2 gap-8">
      <div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-4">Channel Engagement Rate</div>
        {channelData.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Initializing analytics...</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {channelData.map((row) => (
              <div key={row.label} className="flex items-center gap-3 text-[11px]">
                <span className="w-[100px] text-muted-foreground text-right flex-shrink-0">{row.label}</span>
                <div className="flex-1 h-5 bg-[rgba(255,255,255,0.04)] rounded-sm overflow-hidden">
                  <div className={`chart-bar-fill ${row.color}`} style={{ width: `${row.value}%` }} />
                </div>
                <span className="w-10 text-foreground text-[12px] text-right">{row.value}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-4">Segment Conversion Rate</div>
        {conversionData.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Initializing analytics...</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {conversionData.map((row) => (
              <div key={row.label} className="flex items-center gap-3 text-[11px]">
                <span className="w-[100px] text-muted-foreground text-right flex-shrink-0">{row.label}</span>
                <div className="flex-1 h-5 bg-[rgba(255,255,255,0.04)] rounded-sm overflow-hidden">
                  <div className={`chart-bar-fill ${row.color}`} style={{ width: `${row.value}%` }} />
                </div>
                <span className="w-10 text-foreground text-[12px] text-right">{row.value}%</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-2">Session Activity</div>
          <div className="flex items-end gap-[3px] h-12">
            {sparkline.map((v, i) => (
              <div key={i} className="sparkline-bar" style={{ height: `${v}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default AnalyticsCharts;
