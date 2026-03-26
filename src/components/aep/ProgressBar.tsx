import type { ProgressStep } from '@/types/aep';

interface Props {
  steps: ProgressStep[];
}

const ProgressBar = ({ steps }: Props) => (
  <div className="flex items-center gap-5 mb-10 px-6 py-4 bg-[hsl(var(--aep-panel))] border border-border rounded-sm">
    {steps.map((s) => (
      <div
        key={s.num}
        className={`progress-step flex items-center gap-2 text-[11px] ${
          s.status === 'done' ? 'text-[hsl(var(--aep-success))]' : s.status === 'active' ? 'text-[hsl(var(--aep-gold))]' : 'text-muted-foreground'
        }`}
      >
        <span
          className={`w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] ${
            s.status === 'done' ? 'bg-[hsl(var(--aep-success))] border-[hsl(var(--aep-success))] text-white' : ''
          }`}
        >
          {s.num}
        </span>
        {s.label}
      </div>
    ))}
  </div>
);

export default ProgressBar;
