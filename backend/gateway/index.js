'use strict';

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const cors = require('cors');
const axios = require('axios');

const authMiddleware = require('./authMiddleware');
const policyEngine = require('./policyEngine');
const replayGuard = require('./replayGuard');
const rateLimiter = require('./rateLimiter');
const sanitizer = require('./sanitizer');
const auditLogger = require('./auditLogger');
const metricsCollector = require('./metricsCollector');
const toolRegistry = require('./toolRegistry');
const { MCPAuditLog } = require('./auditLogger');

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aep';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const VALID_AGENT_IDS = ['analytics', 'audience', 'content', 'journey'];

const app = express();
app.use(express.json());
app.use(cors());

// Redis client (node-redis v4)
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', (err) => console.error('[Redis] Error:', err));

// ── MCP server URL helpers ────────────────────────────────────────────────────

function getMCPServerUrl(server) {
  if (server === 'salesforce') {
    return `http://${process.env.SALESFORCE_MCP_URL || 'mcp-salesforce:5002'}/tools/call`;
  }
  if (server === 'servicenow') {
    return `http://${process.env.SERVICENOW_MCP_URL || 'mcp-servicenow:5003'}/tools/call`;
  }
  return null;
}

// ── POST /mcp/invoke (Task 7.3) ───────────────────────────────────────────────

app.post('/mcp/invoke', authMiddleware, async (req, res) => {
  const startTime = Date.now();
  const { agentId, tool, params, nonce, timestamp } = req.body;

  // 1. Validate required fields
  if (!agentId || !tool || !params || !nonce || !timestamp) {
    return res.status(400).json({
      error: 'missing_required_fields',
      required: ['agentId', 'tool', 'params', 'nonce', 'timestamp'],
    });
  }

  // 2. Replay guard
  const nonceCheck = await replayGuard.checkNonce(redisClient, nonce, timestamp);
  if (!nonceCheck.fresh) {
    return res.status(400).json({ error: 'replay_detected', reason: nonceCheck.reason });
  }

  // 3. Policy check
  const policyCheck = await policyEngine.checkPolicy(agentId, tool);
  if (!policyCheck.allowed) {
    auditLogger.write({
      agentId,
      tool,
      server: toolRegistry.getServer(tool) || 'unknown',
      params,
      outcome: 'denied',
      denyReason: policyCheck.reason,
      httpStatus: 403,
      nonce,
    });
    return res.status(403).json({ error: 'tool_not_permitted', reason: policyCheck.reason });
  }

  // 4. Get policy for rate limit and maxResponseBytes
  const policy = await policyEngine.getPolicy(agentId);

  // 5. Rate limit check
  const rateCheck = await rateLimiter.check(redisClient, agentId, policy);
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'rate_limit_exceeded', retryAfterMs: rateCheck.retryAfterMs });
  }

  // 6. Resolve MCP server
  const server = toolRegistry.getServer(tool);
  if (!server) {
    return res.status(404).json({ error: 'unknown_tool' });
  }

  const serverUrl = getMCPServerUrl(server);

  // 7. Forward to MCP server
  let rawResponse;
  try {
    rawResponse = await axios.post(serverUrl, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: tool, arguments: params },
      id: nonce,
    });
  } catch (err) {
    return res.status(503).json({ error: 'mcp_server_unavailable', server });
  }

  const latencyMs = Date.now() - startTime;

  // 8. Sanitize response
  const sanitized = sanitizer.sanitize(rawResponse.data.result, {
    agentId,
    tool,
    maxBytes: policy.maxResponseBytes,
  });

  // 9. Token / cost estimation
  const tokens = toolRegistry.estimateTokens(sanitized.data);
  const cost = tokens * toolRegistry.getCostPerToken(tool);

  // 10. Audit log
  const auditId = auditLogger.write({
    agentId,
    tool,
    server,
    params,
    outcome: 'allowed',
    httpStatus: 200,
    latencyMs,
    tokensUsed: tokens,
    estimatedCostUsd: cost,
    responseWarnings: sanitized.warnings,
    nonce,
  });

  // 11. Metrics
  await metricsCollector.record(redisClient, agentId, tool, latencyMs, tokens, cost);

  return res.status(200).json({
    success: true,
    data: sanitized.data,
    meta: {
      latencyMs,
      tokensUsed: tokens,
      estimatedCostUsd: cost,
      auditId,
    },
  });
});

// ── GET /mcp/metrics (Task 7.5) ───────────────────────────────────────────────

app.get('/mcp/metrics', async (req, res) => {
  const window = ['1h', '24h', '7d'].includes(req.query.window) ? req.query.window : '24h';
  const result = await metricsCollector.getMetrics(redisClient, window);
  return res.status(200).json({ success: true, data: result, window });
});

// ── GET /mcp/audit (Task 7.5) ─────────────────────────────────────────────────

app.get('/mcp/audit', async (req, res) => {
  const { agentId, tool, from, to } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

  const query = {};
  if (agentId) query.agentId = agentId;
  if (tool) query.tool = tool;
  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(from);
    if (to) query.timestamp.$lte = new Date(to);
  }

  const entries = await MCPAuditLog.find(query).sort({ timestamp: -1 }).limit(limit);
  return res.status(200).json({ success: true, data: entries });
});

// ── GET /mcp/policy/:agentId (Task 7.6) ──────────────────────────────────────

app.get('/mcp/policy/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const policy = await policyEngine.getPolicy(agentId);
  if (!policy) {
    return res.status(404).json({ error: 'policy_not_found', agentId });
  }
  return res.status(200).json({ success: true, data: policy });
});

// ── PUT /mcp/policy/:agentId (Task 7.6) ──────────────────────────────────────

app.put('/mcp/policy/:agentId', async (req, res) => {
  const { agentId } = req.params;
  if (!VALID_AGENT_IDS.includes(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      validAgentIds: VALID_AGENT_IDS,
    });
  }
  const updated = await policyEngine.updatePolicy(agentId, {
    ...req.body,
    updatedBy: req.body.updatedBy || 'api',
  });
  return res.status(200).json({ success: true, data: updated });
});

// ── GET /mcp/tools ────────────────────────────────────────────────────────────

app.get('/mcp/tools', (req, res) => {
  return res.status(200).json(toolRegistry.listTools());
});

// ── GET /health ───────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  return res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function startGateway() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB connected');

  await redisClient.connect();
  console.log('✅ Redis connected');

  await policyEngine.seedDefaultPolicies();
  console.log('✅ Default policies seeded');

  app.listen(PORT, () => console.log(`✅ Agent Gateway running on :${PORT}`));
}

startGateway().catch((err) => {
  console.error('❌ Gateway startup failed:', err);
  process.exit(1);
});

module.exports = app; // for testing
