'use strict';

require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5002;

const hasCreds =
  process.env.SALESFORCE_CLIENT_ID &&
  process.env.SALESFORCE_CLIENT_SECRET &&
  process.env.SALESFORCE_INSTANCE_URL;

// ── OAuth token cache ─────────────────────────────────────────────────────────
let _accessToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SALESFORCE_CLIENT_ID,
    client_secret: process.env.SALESFORCE_CLIENT_SECRET,
  });
  const res = await axios.post(
    `${process.env.SALESFORCE_INSTANCE_URL}/services/oauth2/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  _accessToken = res.data.access_token;
  _tokenExpiry = Date.now() + (res.data.expires_in || 3600) * 1000 - 60000;
  return _accessToken;
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function salesforceGetLeads(args) {
  if (hasCreds) {
    const token = await getAccessToken();
    const status = (args.filter && args.filter.status) || 'Open';
    const limit = args.limit || 20;
    const query = `SELECT+Id,Name,Status,LeadSource+FROM+Lead+WHERE+Status='${status}'+LIMIT+${limit}`;
    const res = await axios.get(
      `${process.env.SALESFORCE_INSTANCE_URL}/services/data/v57.0/query?q=${query}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data.records || res.data;
  }
  const segment = (args.filter && args.filter.segment) || 'unknown';
  const status = (args.filter && args.filter.status) || 'Open';
  return [
    { Id: 'lead_001', Name: 'Alice Johnson', Status: status, LeadSource: 'Web', Segment: segment },
    { Id: 'lead_002', Name: 'Bob Smith', Status: status, LeadSource: 'Phone', Segment: segment },
    { Id: 'lead_003', Name: 'Carol White', Status: status, LeadSource: 'Email', Segment: segment },
  ];
}

async function salesforceGetCases(args) {
  if (hasCreds) {
    const token = await getAccessToken();
    const status = args.status || 'New';
    const limit = args.limit || 20;
    const query = `SELECT+Id,Subject,Status,Priority+FROM+Case+WHERE+Status='${status}'+LIMIT+${limit}`;
    const res = await axios.get(
      `${process.env.SALESFORCE_INSTANCE_URL}/services/data/v57.0/query?q=${query}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data.records || res.data;
  }
  const status = args.status || 'New';
  return [
    { Id: 'case_001', Subject: 'Login issue', Status: status, Priority: 'High' },
    { Id: 'case_002', Subject: 'Billing error', Status: status, Priority: 'Medium' },
    { Id: 'case_003', Subject: 'Feature request', Status: status, Priority: 'Low' },
  ];
}

async function salesforceGetOpportunities(args) {
  if (hasCreds) {
    const token = await getAccessToken();
    const stage = args.stage || 'Prospecting';
    const limit = args.limit || 20;
    const query = `SELECT+Id,Name,StageName,Amount+FROM+Opportunity+WHERE+StageName='${stage}'+LIMIT+${limit}`;
    const res = await axios.get(
      `${process.env.SALESFORCE_INSTANCE_URL}/services/data/v57.0/query?q=${query}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data.records || res.data;
  }
  const stage = args.stage || 'Prospecting';
  return [
    { Id: 'opp_001', Name: 'Enterprise Deal', Stage: stage, Amount: 50000 },
    { Id: 'opp_002', Name: 'SMB Expansion', Stage: stage, Amount: 15000 },
    { Id: 'opp_003', Name: 'Renewal Q4', Stage: stage, Amount: 30000 },
  ];
}

async function salesforceUpdateLead(args) {
  if (hasCreds) {
    const token = await getAccessToken();
    await axios.patch(
      `${process.env.SALESFORCE_INSTANCE_URL}/services/data/v57.0/sobjects/Lead/${args.leadId}`,
      args.updates,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return { Id: args.leadId, updated: true, ...args.updates };
  }
  return { Id: args.leadId, updated: true, ...args.updates };
}

// ── Tool dispatch ─────────────────────────────────────────────────────────────

const TOOLS = {
  'salesforce.getLeads': {
    validate: (args) => {
      if (!args || typeof args.filter === 'undefined') {
        return 'filter is required';
      }
      return null;
    },
    handler: salesforceGetLeads,
  },
  'salesforce.getCases': {
    validate: () => null,
    handler: salesforceGetCases,
  },
  'salesforce.getOpportunities': {
    validate: () => null,
    handler: salesforceGetOpportunities,
  },
  'salesforce.updateLead': {
    validate: (args) => {
      if (!args || !args.leadId) return 'leadId is required';
      if (!args.updates) return 'updates is required';
      return null;
    },
    handler: salesforceUpdateLead,
  },
};

// ── Route ─────────────────────────────────────────────────────────────────────

app.post('/tools/call', async (req, res) => {
  const { jsonrpc, method, params, id } = req.body;

  if (jsonrpc !== '2.0' || method !== 'tools/call') {
    return res.json({ jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: id || null });
  }

  const toolName = params && params.name;
  const args = (params && params.arguments) || {};

  console.log(`[salesforce-mcp] tool call: ${toolName}`, args);

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
    console.error(`[salesforce-mcp] error in ${toolName}:`, err.message);
    return res.json({ jsonrpc: '2.0', error: { code: -32603, message: err.message }, id });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[salesforce-mcp] listening on port ${PORT} (creds: ${hasCreds ? 'real' : 'mock'})`);
  });
}

module.exports = app;
