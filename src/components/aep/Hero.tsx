const Hero = () => (
  <section className="pt-20 pb-[60px] px-10 max-w-[1400px] mx-auto">
    <p className="text-[11px] tracking-[0.2em] uppercase text-primary mb-5">
      Adobe Experience Platform · Autonomous Marketing Intelligence
    </p>
    <h1 className="font-['Fraunces'] text-[clamp(40px,5vw,72px)] font-semibold leading-[1.05] text-foreground max-w-[760px] mb-6">
      From intelligent assistance<br />to agentic <em className="italic text-[hsl(var(--aep-gold))]">autonomy</em>
    </h1>
    <p className="text-[13px] text-muted-foreground max-w-[540px] leading-[1.8] mb-10">
      A sample implementation of the AEP Agent Orchestrator — coordinating Audience, Content, Journey, and Analytics agents to automate context creation, tagging, publishing, and behavioral tracking across the full marketing lifecycle.
    </p>
  </section>
);

export default Hero;
