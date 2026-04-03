'use strict';

require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5003;

const hasCreds =
  process.env.SERVICENOW_INSTANCE_URL &&
  process.env.SERVICENOW_USERNAME &&
  process.env.SERVICENOW_PASSWORD;

// ── Helper: build Basic auth header ──────────────────────────────────────────

function authHeader() {
  const creds = Buffer.from(
    `${process.env.SERVICENOW_USERNAME}:${process.env.SERVICENOW_PASSWORD}`
  ).toString('base64');
  return { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function servicenowGetIncidents(args) {
  if (hasCreds) {
    const priority = args.priority || '';
    const limit = args.limit || 20;
    const query = priority ? `priority=${priority}` : '';
    const res = await axios.get(
      `${process.env.SERVICENOW_INSTANCE_URL}/api/now/table/incident?sysparm_limit=${limit}${query ? `&sysparm_query=${query}` : ''}`,
      { headers: authHeader() }
    );
    return res.data.result || res.data;
  }
  const priority = args.priority || '2';
  return [
    { sys_id: 'inc_001', number: 'INC0001', short_description: 'Server down', priority, state: 'In Progress' },
    { sys_id: 'inc_002', number: 'INC0002', short_description: 'Network outage', priority, state: 'New' },
    { sys_id: 'inc_003', number: 'INC0003', short_description: 'DB connection failed', priority, state: 'In Progress' },
  ];
}

async function servicenowGetChangeRequests(args) {
  if (hasCreds) {
    const state = args.state || '';
    const limit = args.limit || 20;
    const query = state ? `state=${state}` : '';
    const res = await axios.get(
      `${process.env.SERVICENOW_INSTANCE_URL}/api/now/table/change_request?sysparm_limit=${limit}${query ? `&sysparm_query=${query}` : ''}`,
      { headers: authHeader() }
    );
    return res.data.result || res.data;
  }
  const state = args.state || 'scheduled';
  return [
    { sys_id: 'chg_001', number: 'CHG0001', short_description: 'Deploy v2.0', state, risk: 'low' },
    { sys_id: 'chg_002', number: 'CHG0002', short_description: 'Patch OS', state, risk: 'medium' },
    { sys_id: 'chg_003', number: 'CHG0003', short_description: 'Update firewall rules', state, risk: 'high' },
  ];
}

async function servicenowGetCMDBItem(args) {
  if (hasCreds) {
    const res = await axios.get(
      `${process.env.SERVICENOW_INSTANCE_URL}/api/now/table/cmdb_ci/${args.ciId}`,
      { headers: authHeader() }
    );
    return res.data.result || res.data;
  }
  return {
    sys_id: args.ciId,
    name: 'Web Server 01',
    class: 'cmdb_ci_web_server',
    status: 'installed',
  };
}

async function servicenowCreateIncident(args) {
  if (hasCreds) {
    const res = await axios.post(
      `${process.env.SERVICENOW_INSTANCE_URL}/api/now/table/incident`,
      { short_description: args.shortDescription, priority: args.priority },
      { headers: authHeader() }
    );
    return res.data.result || res.data;
  }
  const now = Date.now();
  return {
    sys_id: `inc_new_${now}`,
    number: `INC${now}`,
    short_description: args.shortDescription,
    priority: args.priority,
    state: 'New',
  };
}

// ── Tool dispatch ─────────────────────────────────────────────────────────────

const TOOLS = {
  'servicenow.getIncidents': {
    validate: () => null,
    handler: servicenowGetIncidents,
  },
  'servicenow.getChangeRequests': {
    validate: () => null,
    handler: servicenowGetChangeRequests,
  },
  'servicenow.getCMDBItem': {
    validate: (args) => {
      if (!args || !args.ciId) return 'ciId is required';
      return null;
    },
    handler: servicenowGetCMDBItem,
  },
  'servicenow.createIncident': {
    validate: (args) => {
      if (!args || !args.shortDescription) return 'shortDescription is required';
      if (!args.priority) return 'priority is required';
      return null;
    },
    handler: servicenowCreateIncident,
  },
};

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy', service: 'mcp-servicenow', timestamp: new Date() });
});

// ── Route ─────────────────────────────────────────────────────────────────────

app.post('/tools/call', async (req, res) => {
  const { jsonrpc, method, params, id } = req.body;

  if (jsonrpc !== '2.0' || method !== 'tools/call') {
    return res.json({ jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: id || null });
  }

  const toolName = params && params.name;
  const args = (params && params.arguments) || {};

  console.log(`[servicenow-mcp] tool call: ${toolName}`, args);

  const tool = TOOLS[toolName];
  if (!tool) {
    return res.json({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id });
  }

  const validationError = tool.validate(args);
  if (validationError) {
    return res.json({ jsonrpc: '2.0', error: { code: -32602, message: `Invalid params: ${validationError}` }, id });
  }

  try {
    const result = await tool.handler(args);
    return res.json({ jsonrpc: '2.0', result, id });
  } catch (err) {
    console.error(`[servicenow-mcp] error in ${toolName}:`, err.message);
    return res.json({ jsonrpc: '2.0', error: { code: -32603, message: err.message }, id });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[servicenow-mcp] listening on port ${PORT} (creds: ${hasCreds ? 'real' : 'mock'})`);
  });
}

module.exports = app;
