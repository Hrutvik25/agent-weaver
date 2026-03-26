import { useState, useCallback, useRef } from 'react';
import Header from '@/components/aep/Header';
import Hero from '@/components/aep/Hero';
import ProgressBar from '@/components/aep/ProgressBar';
import Pipeline from '@/components/aep/Pipeline';
import SegmentsPanel from '@/components/aep/SegmentsPanel';
import ContentPanel from '@/components/aep/ContentPanel';
import AnalyticsStreamPanel from '@/components/aep/AnalyticsStreamPanel';
import AnalyticsCharts from '@/components/aep/AnalyticsCharts';
import Terminal from '@/components/aep/Terminal';
import Footer from '@/components/aep/Footer';
import type { AgentData, LogEntry, SegmentData, ContentItem, ChartRow, StreamEvent, ProgressStep } from '@/types/aep';

const initialAgents: AgentData[] = [
  { id: 'audience', icon: '👥', name: 'Audience Agent', description: 'Creates and optimizes audience segments using real-time CDP data and behavioral signals.', status: 'idle', metrics: [{ label: 'Segments', value: '—', color: '' }, { label: 'Profiles', value: '—', color: '' }] },
  { id: 'content', icon: '✍️', name: 'Content Production Agent', description: 'Assembles and personalizes campaign assets at scale using generative AI and brand guidelines.', status: 'idle', metrics: [{ label: 'Assets', value: '—', color: '' }, { label: 'Variants', value: '—', color: '' }] },
  { id: 'experiment', icon: '🧪', name: 'Experimentation Agent', description: 'Hypothesizes, simulates, and optimizes A/B tests. Auto-publishes winning variants.', status: 'idle', metrics: [{ label: 'Tests', value: '—', color: '' }, { label: 'Confidence', value: '—', color: '' }] },
  { id: 'journey', icon: '🗺️', name: 'Journey Agent', description: 'Orchestrates cross-channel experiences. Adapts touchpoints in real-time to customer context.', status: 'idle', metrics: [{ label: 'Journeys', value: '—', color: '' }, { label: 'Channels', value: '—', color: '' }] },
];

const initialSteps: ProgressStep[] = [
  { num: 1, label: 'Data Ingestion', status: 'pending' },
  { num: 2, label: 'Audience Segment', status: 'pending' },
  { num: 3, label: 'Content Generation', status: 'pending' },
  { num: 4, label: 'Tag & Publish', status: 'pending' },
  { num: 5, label: 'Journey Activate', status: 'pending' },
  { num: 6, label: 'Analytics Collect', status: 'pending' },
];

function getTime(): string {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
}

const Index = () => {
  const [agents, setAgents] = useState<AgentData[]>(initialAgents);
  const [logs, setLogs] = useState<LogEntry[]>([{ time: '00:00:00', tag: '[SYSTEM]', tagClass: 'system', message: 'AEP Agent Orchestrator initialized. Agents standby.' }]);
  const [segments, setSegments] = useState<SegmentData[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentTags, setContentTags] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [channelData, setChannelData] = useState<ChartRow[]>([]);
  const [conversionData, setConversionData] = useState<ChartRow[]>([]);
  const [sparkline, setSparkline] = useState<number[]>([20, 35, 25, 45, 30, 55, 40, 60, 35, 50, 45, 65]);
  const [steps, setSteps] = useState<ProgressStep[]>(initialSteps);
  const [running, setRunning] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addLog = useCallback((tag: string, tagClass: string, message: string) => {
    setLogs(prev => [...prev, { time: getTime(), tag: `[${tag}]`, tagClass, message }]);
  }, []);

  const updateAgent = useCallback((id: string, updates: Partial<AgentData>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const updateStep = useCallback((num: number, status: ProgressStep['status']) => {
    setSteps(prev => prev.map(s => s.num === num ? { ...s, status } : s));
  }, []);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay);
    timersRef.current.push(t);
  }, []);

  const runOrchestration = useCallback(() => {
    if (running) return;
    setRunning(true);

    // Step 1: Data Ingestion
    updateStep(1, 'active');
    addLog('ORCHESTRATOR', 'orchestrator', 'Pipeline initiated. Starting data ingestion...');

    schedule(() => {
      updateStep(1, 'done');
      addLog('SYSTEM', 'system', 'Real-time CDP data loaded. 2.4M profiles available.');

      // Step 2: Audience
      updateStep(2, 'active');
      updateAgent('audience', { status: 'running' });
      addLog('AUDIENCE', 'audience', 'Audience Agent activated. Analyzing behavioral signals...');
    }, 1200);

    schedule(() => {
      addLog('AUDIENCE', 'audience', 'Clustering 2.4M profiles across 14 dimensions...');
    }, 2400);

    schedule(() => {
      updateAgent('audience', {
        status: 'done',
        metrics: [{ label: 'Segments', value: '6', color: 'red' }, { label: 'Profiles', value: '2.4M', color: 'gold' }]
      });
      updateStep(2, 'done');
      addLog('AUDIENCE', 'audience', '6 high-value segments created. Top: "Cart Abandoners 7d" (340K)');
      setSegments([
        { name: 'Cart Abandoners — 7 day', size: '340K', tag: 'Active' },
        { name: 'High-Value Repeat Buyers', size: '185K', tag: 'Active' },
        { name: 'Browse-Only — Luxury', size: '420K', tag: 'New' },
        { name: 'Loyalty Tier: Platinum', size: '92K', tag: 'Active' },
        { name: 'Email Re-engagement', size: '510K', tag: 'Active' },
      ]);

      // Step 3: Content
      updateStep(3, 'active');
      updateAgent('content', { status: 'running' });
      addLog('CONTENT', 'content', 'Content Agent activated. Generating personalized assets...');
    }, 4000);

    schedule(() => {
      addLog('CONTENT', 'content', 'Applying brand guidelines. Generating 12 variants...');
    }, 5200);

    schedule(() => {
      updateAgent('content', {
        status: 'done',
        metrics: [{ label: 'Assets', value: '12', color: 'cyan' }, { label: 'Variants', value: '36', color: 'green' }]
      });
      updateStep(3, 'done');
      addLog('CONTENT', 'content', '12 assets generated across 3 channels. 36 personalized variants.');
      setContentItems([
        { type: 'Email', title: 'Cart Recovery — Personalized Product Grid', badge: 'Published', badgeClass: 'badge-published' },
        { type: 'Push', title: 'Flash Sale Alert — Loyalty Platinum', badge: 'Published', badgeClass: 'badge-published' },
        { type: 'Web', title: 'Hero Banner — Browse-Only Luxury Segment', badge: 'Pending', badgeClass: 'badge-pending' },
        { type: 'SMS', title: 'Re-engagement — 30% Off Coupon', badge: 'Draft', badgeClass: 'badge-draft' },
      ]);
      setContentTags(['personalization', 'a/b test', 'dynamic', 'brand-safe', 'multilingual']);
      setActiveTags(['personalization', 'dynamic']);

      // Step 4: Tag & Publish
      updateStep(4, 'active');
      updateAgent('experiment', { status: 'running' });
      addLog('ORCHESTRATOR', 'orchestrator', 'Tagging assets and publishing to AEP...');
    }, 6800);

    schedule(() => {
      updateAgent('experiment', {
        status: 'done',
        metrics: [{ label: 'Tests', value: '4', color: 'gold' }, { label: 'Confidence', value: '94%', color: 'green' }]
      });
      updateStep(4, 'done');
      addLog('ORCHESTRATOR', 'orchestrator', 'A/B tests configured. 4 experiments, 94% confidence threshold.');

      // Step 5: Journey
      updateStep(5, 'active');
      updateAgent('journey', { status: 'running' });
      addLog('JOURNEY', 'journey', 'Journey Agent activated. Mapping cross-channel touchpoints...');
    }, 8500);

    schedule(() => {
      addLog('JOURNEY', 'journey', 'Activating 3 journeys across 5 channels...');
    }, 9500);

    schedule(() => {
      updateAgent('journey', {
        status: 'done',
        metrics: [{ label: 'Journeys', value: '3', color: 'red' }, { label: 'Channels', value: '5', color: 'cyan' }]
      });
      updateStep(5, 'done');
      addLog('JOURNEY', 'journey', '3 journeys activated. Channels: Email, Push, Web, SMS, In-App.');

      // Step 6: Analytics
      updateStep(6, 'active');
      addLog('ANALYTICS', 'analytics', 'Analytics collection started. Streaming live events...');
    }, 11000);

    // Analytics data
    schedule(() => {
      setChannelData([
        { label: 'Email', value: 72, color: 'red' },
        { label: 'Push', value: 58, color: 'gold' },
        { label: 'Web', value: 85, color: 'cyan' },
        { label: 'SMS', value: 41, color: 'green' },
      ]);
      setConversionData([
        { label: 'Cart Abandon', value: 24, color: 'red' },
        { label: 'High-Value', value: 67, color: 'gold' },
        { label: 'Browse-Only', value: 18, color: 'cyan' },
        { label: 'Re-engage', value: 31, color: 'green' },
      ]);
    }, 12000);

    // Stream events
    const streamData: StreamEvent[] = [
      { eventType: 'click', user: 'usr_8x92k', action: 'Clicked CTA — Cart Recovery Email', time: '2s ago' },
      { eventType: 'view', user: 'usr_3m41q', action: 'Viewed Hero Banner — Luxury Segment', time: '5s ago' },
      { eventType: 'convert', user: 'usr_7p28w', action: 'Converted — Flash Sale Push Notification', time: '8s ago' },
      { eventType: 'click', user: 'usr_1k55r', action: 'Opened Re-engagement SMS', time: '12s ago' },
      { eventType: 'exit', user: 'usr_9d33v', action: 'Exited Journey — Browse Only', time: '15s ago' },
      { eventType: 'convert', user: 'usr_4h77j', action: 'Completed Purchase — Loyalty Platinum', time: '18s ago' },
    ];

    streamData.forEach((evt, i) => {
      schedule(() => {
        setStreamEvents(prev => [evt, ...prev]);
      }, 12500 + i * 800);
    });

    // Finalize
    schedule(() => {
      updateStep(6, 'done');
      addLog('ANALYTICS', 'analytics', 'Live stream active. 6 events captured.');
      addLog('ORCHESTRATOR', 'orchestrator', '✓ Full pipeline complete. All agents reporting nominal.');
      setSparkline([45, 60, 35, 75, 50, 85, 65, 90, 55, 70, 60, 80]);
      setRunning(false);
    }, 17000);
  }, [running, addLog, updateAgent, updateStep, schedule]);

  const resetOrchestration = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRunning(false);
    setAgents(initialAgents);
    setLogs([{ time: '00:00:00', tag: '[SYSTEM]', tagClass: 'system', message: 'AEP Agent Orchestrator initialized. Agents standby.' }]);
    setSegments([]);
    setContentItems([]);
    setContentTags([]);
    setActiveTags([]);
    setStreamEvents([]);
    setChannelData([]);
    setConversionData([]);
    setSparkline([20, 35, 25, 45, 30, 55, 40, 60, 35, 50, 45, 65]);
    setSteps(initialSteps);
  }, []);

  return (
    <div className="relative z-[1]">
      <Header />
      <Hero />

      <div className="max-w-[1400px] mx-auto px-10 pb-20">
        {/* Run Controls */}
        <div className="flex items-center gap-4 mb-12">
          <button className="btn-run" onClick={runOrchestration} disabled={running}>
            ▶ Run Orchestration
          </button>
          <button className="btn-secondary" onClick={resetOrchestration}>Reset</button>
          <span className="text-[11px] text-muted-foreground">Click to trigger the full autonomous agent pipeline</span>
        </div>

        {/* Progress */}
        <ProgressBar steps={steps} />

        {/* Pipeline */}
        <Pipeline agents={agents} />

        {/* Live Intelligence */}
        <div className="flex items-center gap-3 text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-5">
          Live Intelligence
          <span className="flex-1 h-px bg-border" />
        </div>

        <div className="grid grid-cols-3 gap-5 mb-12">
          <SegmentsPanel segments={segments} />
          <ContentPanel items={contentItems} tags={contentTags} activeTags={activeTags} />
          <AnalyticsStreamPanel events={streamEvents} />
        </div>

        {/* Analytics Charts */}
        <AnalyticsCharts channelData={channelData} conversionData={conversionData} sparkline={sparkline} />

        {/* Terminal */}
        <div className="flex items-center gap-3 text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-5">
          Orchestrator Console
          <span className="flex-1 h-px bg-border" />
        </div>
        <Terminal logs={logs} />
      </div>

      <Footer />
    </div>
  );
};

export default Index;
