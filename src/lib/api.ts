import axios, { AxiosInstance, AxiosError } from "axios";

// All requests go through Nginx gateway - no hardcoded ports
const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Centralised error handling
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Typed helpers ──────────────────────────────────────────────────────────

export const audienceApi = {
  list: () => api.get("/audiences"),
  summary: () => api.get("/audiences/summary"),
  get: (id: string) => api.get(`/audiences/${id}`),
  create: (data: unknown) => api.post("/audiences", data),
};

export const contentApi = {
  get: (id: string) => api.get(`/content/${id}`),
  create: (data: unknown) => api.post("/content", data),
  publish: (id: string) => api.post(`/content/${id}/publish`),
  bySegment: (segment: string) => api.get(`/content/segment/${segment}`),
};

export const journeyApi = {
  list: () => api.get("/journeys"),
  get: (id: string) => api.get(`/journeys/${id}`),
  create: (data: unknown) => api.post("/journeys", data),
  activate: (id: string) => api.post(`/journeys/${id}/activate`),
  addStep: (id: string, step: unknown) => api.post(`/journeys/${id}/steps`, step),
};

export const analyticsApi = {
  track: (data: unknown) => api.post("/analytics/events", data),
  metrics: (journeyId: string) => api.get(`/analytics/metrics/${journeyId}`),
  feedback: (data: unknown) => api.post("/analytics/feedback", data),
};

export const statsApi = {
  get: () => api.get("/stats"),
};

export const orchestratorApi = {
  run: (data: unknown) => api.post("/orchestrate", data),
  batch: (events: unknown[]) => api.post("/orchestrate/batch", { events }),
  health: () => api.get("/health"),
};

export const mcpApi = {
  metrics: (window: '1h' | '24h' | '7d' = '24h') =>
    api.get(`/mcp/metrics?window=${window}`),
  audit: (params?: { agentId?: string; tool?: string; limit?: number }) =>
    api.get('/mcp/audit', { params }),
  getPolicy: (agentId: string) =>
    api.get(`/mcp/policy/${agentId}`),
  updatePolicy: (agentId: string, policy: Record<string, unknown>) =>
    api.put(`/mcp/policy/${agentId}`, policy),
};
