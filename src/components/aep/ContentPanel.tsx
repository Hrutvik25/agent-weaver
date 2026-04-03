import type { ContentItem } from '@/types/aep';

interface Props {
  items: ContentItem[];
  tags: string[];
  activeTags: string[];
}

const badgeStyle = (cls: string) => {
  if (cls === 'badge-published') return 'text-[hsl(var(--aep-success))] bg-[rgba(46,204,140,0.1)] border border-[rgba(46,204,140,0.2)]';
  if (cls === 'badge-pending') return 'text-[hsl(var(--aep-gold))] bg-[rgba(232,168,56,0.1)] border border-[rgba(232,168,56,0.2)]';
  return 'text-muted-foreground bg-[rgba(107,107,122,0.1)] border border-[rgba(107,107,122,0.2)]';
};

const ContentPanel = ({ items, tags, activeTags }: Props) => (
  <div className="bg-[hsl(var(--aep-panel))] border border-border rounded-sm p-6">
    <div className="font-['Syne'] font-bold text-[11px] tracking-[0.12em] uppercase text-muted-foreground mb-5 flex items-center justify-between">
      <span>Content Queue —</span>
    </div>
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">Awaiting Content Agent...</div>
      ) : (
        items.map((item, i) => (
          <div key={i} className="content-item">
            <span className="text-[9px] uppercase tracking-[0.1em] text-[hsl(var(--aep-cyan))] min-w-[60px] pt-px">{item.type}</span>
            <span className="text-foreground leading-[1.5]">{item.title}</span>
            <span className={`ml-auto text-[9px] uppercase tracking-[0.08em] px-[7px] py-0.5 rounded-sm flex-shrink-0 ${badgeStyle(item.badgeClass)}`}>
              {item.badge}
            </span>
          </div>
        ))
      )}
    </div>
    {tags.length > 0 && (
      <div className="flex flex-wrap gap-2 mt-3">
        {tags.map((t) => (
          <span key={t} className={`tag ${activeTags.includes(t) ? 'active-tag' : ''}`}>{t}</span>
        ))}
      </div>
    )}
  </div>
);

export default ContentPanel;
