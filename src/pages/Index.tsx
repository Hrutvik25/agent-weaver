import { useState, useCallback, useEffect } from 'react';
import Header from '@/components/aep/Header';
import Hero from '@/components/aep/Hero';
import ProgressBar from '@/components/aep/ProgressBar';
import Pipeline from '@/components/aep/Pipeline';
import SegmentsPanel from '@/components/aep/SegmentsPanel';
import ContentPanel from '@/components/aep/ContentPanel';
import AnalyticsStreamPanel from '@/components/aep/AnalyticsStreamPanel';
import AnalyticsCharts from '@/components/aep/AnalyticsCharts';
import MCPMetricsPanel from '@/components/aep/MCPMetricsPanel';
import Terminal from '@/components/aep/Terminal';
import Footer from '@/components/aep/Footer';
import { orchestratorApi, audienceApi, journeyApi, statsApi } from '@/lib/api';
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
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [channelData, setChannelData] = useState<ChartRow[]>([]);
  const [conversionData, setConversionData] = useState<ChartRow[]>([]);
  const [sparkline, setSparkline] = useState<number[]>([20, 35, 25, 45, 30, 55, 40, 60, 35, 50, 45, 65]);
  const [steps, setSteps] = useState<ProgressStep[]>(initialSteps);
  const [running, setRunning] = useState(false);

  const addLog = useCallback((tag: string, tagClass: string, message: string) => {
    setLogs(prev => [...prev, { time: getTime(), tag: `[${tag}]`, tagClass, message }]);
  }, []);

  const updateAgent = useCallback((id: string, updates: Partial<AgentData>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const updateStep = useCallback((num: number, status: ProgressStep['status']) => {
    setSteps(prev => prev.map(s => s.num === num ? { ...s, status } : s));
  }, []);

  // Fetch audiences from backend and update segments panel
  const fetchAudiences = useCallback(async () => {
    try {
      const res = await audienceApi.list();
      const data = res.data?.data || [];
      const segmentMap: Record<string, number> = {};
      data.forEach((a: { segment: string }) => {
        segmentMap[a.segment] = (segmentMap[a.segment] || 0) + 1;
      });

      const segmentColors: Record<string, string> = {
        highly_engaged_users: 'Active',
        potential_converters: 'New',
        drop_off_users: 'At Risk',
      };

      setSegments(Object.entries(segmentMap).map(([name, count]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        size: String(count),
        tag: segmentColors[name] || 'Active',
      })));

      // Update audience agent metrics
      updateAgent('audience', {
        status: data.length > 0 ? 'done' : 'idle',
        metrics: [
          { label: 'Segments', value: String(Object.keys(segmentMap).length), color: 'red' },
          { label: 'Profiles', value: String(data.length), color: 'gold' },
        ],
      });

      // Update conversion chart
      setConversionData(Object.entries(segmentMap).map(([name, count], i) => ({
        label: name.replace(/_/g, ' ').split(' ').slice(0, 2).join(' '),
        value: count,
        color: ['red', 'gold', 'cyan'][i % 3],
      })));
    } catch (_) { /* silent */ }
  }, [updateAgent]);

  // Fetch journeys from backend and update journey section
  const fetchJourneys = useCallback(async () => {
    try {
      const res = await journeyApi.list();
      const data = res.data?.data || [];

      setContentItems(data.slice(0, 4).map((j: { audienceSegment: string; journeyId: string; status: string }) => ({
        type: j.audienceSegment?.replace(/_/g, ' ') || 'Segment',
        title: `Journey: ${j.journeyId}`,
        badge: j.status === 'active' ? 'Active' : 'Draft',
        badgeClass: j.status === 'active' ? 'badge-published' : 'badge-pending',
      })));

      updateAgent('journey', {
        status: data.length > 0 ? 'done' : 'idle',
        metrics: [
          { label: 'Journeys', value: String(data.length), color: 'red' },
          { label: 'Channels', value: '5', color: 'cyan' },
        ],
      });
    } catch (_) { /* silent */ }
  }, [updateAgent]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await statsApi.get();
      const data = res.data?.data;
      if (!data) return;

      setSparkline(prev => [...prev.slice(1), data.totalEvents % 100]);
      setChannelData([
        { label: 'Total Users', value: data.totalUsers, color: 'red' },
        { label: 'Journeys', value: data.totalJourneys, color: 'gold' },
        { label: 'Events', value: Math.min(data.totalEvents, 100), color: 'cyan' },
      ]);
    } catch (_) { /* silent */ }
  }, []);

  // Connect to SSE stream for real-time backend logs
  useEffect(() => {
    const es = new EventSource('http://localhost:5000/api/logs/stream');
    es.onmessage = (e) => {
      try {
        const log = JSON.parse(e.data);
        setLogs(prev => [...prev.slice(-200), log]); // keep last 200 logs
      } catch (_) {}
    };
    es.onerror = () => {
      setLogs(prev => [...prev, { time: getTime(), tag: '[SYSTEM]', tagClass: 'system', message: 'SSE connection lost. Reconnecting...' }]);
    };
    return () => es.close();
  }, []);

  // Poll every 5 seconds for live updates
  useEffect(() => {
    fetchAudiences();
    fetchJourneys();
    fetchStats();

    const interval = setInterval(() => {
      fetchAudiences();
      fetchJourneys();
      fetchStats();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchAudiences, fetchJourneys, fetchStats]);

  const runOrchestration = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setSteps(initialSteps);
    setAgents(initialAgents);

    addLog('ORCHESTRATOR', 'orchestrator', 'Pipeline initiated. Sending analytics event...');
    updateStep(1, 'active');

    // Set all agents to running
    ['audience', 'content', 'experiment', 'journey'].forEach(id =>
      updateAgent(id, { status: 'running' })
    );

    try {
      updateStep(1, 'done');
      updateStep(2, 'active');
      addLog('SYSTEM', 'system', 'Triggering event pipeline via /api/orchestrate...');

      await orchestratorApi.run({
        analyticsEvent: {
          userId: `user_${Date.now()}`,
          event: 'video_watched',
          watchTime: 120,
          clicked: true,
          contentType: 'course',
        },
      });

      addLog('ANALYTICS', 'analytics', 'Event published to Kafka analytics-events topic.');
      updateStep(2, 'done');
      updateStep(3, 'active');

      // Add stream event
      setStreamEvents(prev => [{
        eventType: 'click',
        user: `usr_${Math.random().toString(36).slice(2, 7)}`,
        action: 'Triggered orchestration pipeline',
        time: 'just now',
      }, ...prev]);

      // Wait for pipeline to process then fetch results
      setTimeout(async () => {
        addLog('AUDIENCE', 'audience', 'Fetching audience segments from MongoDB...');
        await fetchAudiences();
        updateStep(3, 'done');
        updateStep(4, 'active');
        addLog('CONTENT', 'content', 'Content recommendations generated by ContentAgent.');
        updateAgent('content', { status: 'done', metrics: [{ label: 'Assets', value: '1', color: 'cyan' }, { label: 'Variants', value: '3', color: 'green' }] });
        updateStep(4, 'done');
        updateStep(5, 'active');

        setTimeout(async () => {
          await fetchJourneys();
          updateStep(5, 'done');
          updateStep(6, 'active');
          addLog('JOURNEY', 'journey', 'Personalized journey created by JourneyAgent.');
          updateAgent('experiment', { status: 'done', metrics: [{ label: 'Tests', value: '2', color: 'gold' }, { label: 'Confidence', value: '90%', color: 'green' }] });

          setTimeout(async () => {
            await fetchStats();
            updateStep(6, 'done');
            addLog('ANALYTICS', 'analytics', 'Live stream active. Pipeline complete.');
            addLog('ORCHESTRATOR', 'orchestrator', '✓ Full pipeline complete. All agents reporting nominal.');
            setSparkline([45, 60, 35, 75, 50, 85, 65, 90, 55, 70, 60, 80]);
            setRunning(false);
          }, 2000);
        }, 2000);
      }, 3000);

    } catch (err) {
      addLog('SYSTEM', 'system', `❌ Pipeline error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setRunning(false);
    }
  }, [running, addLog, updateAgent, updateStep, fetchAudiences, fetchJourneys, fetchStats]);

  const resetOrchestration = useCallback(() => {
    setRunning(false);
    setAgents(initialAgents);
    setLogs([{ time: '00:00:00', tag: '[SYSTEM]', tagClass: 'system', message: 'AEP Agent Orchestrator initialized. Agents standby.' }]);
    setSegments([]);
    setContentItems([]);
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
        <div className="flex items-center gap-4 mb-12">
          <button className="btn-run" onClick={runOrchestration} disabled={running}>
            {running ? '⏳ Running...' : '▶ Run Orchestration'}
          </button>
          <button className="btn-secondary" onClick={resetOrchestration}>Reset</button>
          <span className="text-[11px] text-muted-foreground">Click to trigger the full autonomous agent pipeline</span>
        </div>
        <ProgressBar steps={steps} />
        <Pipeline agents={agents} />
        <div className="flex items-center gap-3 text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-5">
          Live Intelligence
          <span className="flex-1 h-px bg-border" />
        </div>
        <div className="grid grid-cols-3 gap-5 mb-12">
          <SegmentsPanel segments={segments} />
          <ContentPanel items={contentItems} tags={['highly_engaged', 'potential', 'drop_off']} activeTags={[]} />
          <AnalyticsStreamPanel events={streamEvents} />
        </div>
        <AnalyticsCharts channelData={channelData} conversionData={conversionData} sparkline={sparkline} />
        <MCPMetricsPanel />
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
