const Header = () => (
  <header className="px-10 py-6 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-[20px] sticky top-0 z-[100]">
    <div className="flex items-center gap-3">
      <div className="logo-mark" />
      <span className="font-['Syne'] font-extrabold text-[15px] tracking-[0.08em] uppercase text-foreground">
        Adobe <span className="text-primary">AEP</span> Agent Orchestrator
      </span>
    </div>
    <div className="flex items-center gap-6 text-[11px] text-muted-foreground tracking-[0.06em]">
      <span><span className="status-dot" />All Agents Operational</span>
      <span>Env: Production</span>
      <span id="clock" />
    </div>
  </header>
);

export default Header;
