export type AgentStatus = 'idle' | 'running' | 'done';

export interface AgentData {
  id: string;
  icon: string;
  name: string;
  description: string;
  status: AgentStatus;
  metrics: { label: string; value: string; color: string }[];
}

export interface LogEntry {
  time: string;
  tag: string;
  tagClass: string;
  message: string;
}

export interface SegmentData {
  name: string;
  size: string;
  tag: string;
}

export interface ContentItem {
  type: string;
  title: string;
  badge: string;
  badgeClass: string;
}

export interface ChartRow {
  label: string;
  value: number;
  color: string;
}

export interface StreamEvent {
  eventType: string;
  user: string;
  action: string;
  time: string;
}

export type ProgressStepStatus = 'pending' | 'active' | 'done';

export interface ProgressStep {
  num: number;
  label: string;
  status: ProgressStepStatus;
}
