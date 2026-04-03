/**
 * In-memory ToolDefinition registry.
 *
 * Each tool definition includes:
 *   name                  — fully-qualified tool name (e.g. "salesforce.getLeads")
 *   server                — which MCP server handles this tool ('salesforce' | 'servicenow')
 *   description           — human-readable description
 *   inputSchema           — JSON Schema (Draft-7) for the tool's arguments
 *   estimatedTokensPerCall — rough token budget for a typical response
 *   costPerToken          — USD cost per token
 */

/** @type {Map<string, import('./types').ToolDefinition>} */
const registry = new Map();

const TOOLS = [
  // ── Salesforce tools ──────────────────────────────────────────────────────
  {
    name: 'salesforce.getLeads',
    server: 'salesforce',
    description: 'Query Salesforce leads by segment and status.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          properties: {
            segment: { type: 'string' },
            status: { type: 'string' },
          },
        },
        limit: { type: 'number', minimum: 1, maximum: 100 },
      },
      required: ['filter'],
    },
    estimatedTokensPerCall: 500,
    costPerToken: 0.000002,
  },
  {
    name: 'salesforce.getCases',
    server: 'salesforce',
    description: 'Fetch open support cases from Salesforce.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['New', 'Working', 'Escalated', 'Closed'] },
        limit: { type: 'number', minimum: 1, maximum: 100 },
      },
    },
    estimatedTokensPerCall: 400,
    costPerToken: 0.000002,
  },
  {
    name: 'salesforce.getOpportunities',
    server: 'salesforce',
    description: 'Retrieve pipeline opportunities from Salesforce by stage.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 100 },
      },
    },
    estimatedTokensPerCall: 450,
    costPerToken: 0.000002,
  },
  {
    name: 'salesforce.updateLead',
    server: 'salesforce',
    description: 'Update a Salesforce lead record (status, score, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        updates: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            score: { type: 'number' },
          },
        },
      },
      required: ['leadId', 'updates'],
    },
    estimatedTokensPerCall: 200,
    costPerToken: 0.000002,
  },

  // ── ServiceNow tools ──────────────────────────────────────────────────────
  {
    name: 'servicenow.getIncidents',
    server: 'servicenow',
    description: 'Retrieve active ServiceNow incidents filtered by priority.',
    inputSchema: {
      type: 'object',
      properties: {
        priority: { type: 'string', enum: ['1', '2', '3', '4', '5'] },
        limit: { type: 'number', minimum: 1, maximum: 100 },
      },
    },
    estimatedTokensPerCall: 500,
    costPerToken: 0.000002,
  },
  {
    name: 'servicenow.getChangeRequests',
    server: 'servicenow',
    description: 'Fetch pending change requests from ServiceNow.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 100 },
      },
    },
    estimatedTokensPerCall: 450,
    costPerToken: 0.000002,
  },
  {
    name: 'servicenow.getCMDBItem',
    server: 'servicenow',
    description: 'Look up a configuration item (CI) in the ServiceNow CMDB.',
    inputSchema: {
      type: 'object',
      properties: {
        ciId: { type: 'string' },
      },
      required: ['ciId'],
    },
    estimatedTokensPerCall: 300,
    costPerToken: 0.000002,
  },
  {
    name: 'servicenow.createIncident',
    server: 'servicenow',
    description: 'Open a new incident in ServiceNow.',
    inputSchema: {
      type: 'object',
      properties: {
        shortDescription: { type: 'string' },
        priority: { type: 'string', enum: ['1', '2', '3', '4', '5'] },
        category: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['shortDescription', 'priority'],
    },
    estimatedTokensPerCall: 250,
    costPerToken: 0.000002,
  },
];

// Populate the registry map
for (const tool of TOOLS) {
  registry.set(tool.name, tool);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return all registered tool definitions.
 * @returns {Array<object>}
 */
function listTools() {
  return Array.from(registry.values());
}

/**
 * Return the full ToolDefinition for a given tool name, or null if unknown.
 * @param {string} toolName
 * @returns {object|null}
 */
function getToolDef(toolName) {
  return registry.get(toolName) || null;
}

/**
 * Return the MCP server name ('salesforce' | 'servicenow') for a tool, or null.
 * @param {string} toolName
 * @returns {'salesforce'|'servicenow'|null}
 */
function getServer(toolName) {
  const def = registry.get(toolName);
  return def ? def.server : null;
}

/**
 * Return the cost-per-token (USD) for a tool, or 0 if unknown.
 * @param {string} toolName
 * @returns {number}
 */
function getCostPerToken(toolName) {
  const def = registry.get(toolName);
  return def ? def.costPerToken : 0;
}

/**
 * Estimate the number of tokens in a response payload.
 * Uses a simple heuristic: 1 token ≈ 4 characters of JSON.
 * Falls back to the tool's estimatedTokensPerCall when data is unavailable.
 *
 * @param {unknown} data - The response data to estimate
 * @returns {number}
 */
function estimateTokens(data) {
  if (data == null) return 0;
  try {
    const chars = JSON.stringify(data).length;
    return Math.ceil(chars / 4);
  } catch {
    return 0;
  }
}

module.exports = { listTools, getToolDef, getServer, getCostPerToken, estimateTokens };
