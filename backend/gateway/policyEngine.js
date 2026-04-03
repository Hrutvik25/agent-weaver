'use strict';

const mongoose = require('mongoose');
const { minimatch } = require('minimatch');

// ── Mongoose Schema ──────────────────────────────────────────────────────────

const AgentPolicySchema = new mongoose.Schema({
  agentId: {
    type: String,
    required: true,
    enum: ['analytics', 'audience', 'content', 'journey'],
  },
  allowedTools: { type: [String], default: [] },
  rateLimitPerMinute: { type: Number, default: 20 },
  rateLimitPerHour: { type: Number, default: 200 },
  maxResponseBytes: { type: Number, default: 51200 },
  enabled: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String, default: 'system' },
});

const AgentPolicy = mongoose.model('AgentPolicy', AgentPolicySchema);

// ── In-memory cache ──────────────────────────────────────────────────────────

/** @type {Map<string, { policy: object, expiresAt: number }>} */
const policyCache = new Map();
const CACHE_TTL_MS = 60_000;

// ── getPolicy ────────────────────────────────────────────────────────────────

/**
 * Fetch policy for agentId, using in-memory cache with 60s TTL.
 * @param {string} agentId
 * @returns {Promise<object|null>}
 */
async function getPolicy(agentId) {
  const cached = policyCache.get(agentId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.policy;
  }

  const policy = await AgentPolicy.findOne({ agentId });
  policyCache.set(agentId, { policy, expiresAt: Date.now() + CACHE_TTL_MS });
  return policy;
}

// ── checkPolicy ──────────────────────────────────────────────────────────────

/**
 * Check whether agentId is allowed to call tool.
 * @param {string} agentId
 * @param {string} tool
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
async function checkPolicy(agentId, tool) {
  const policy = await getPolicy(agentId);

  if (!policy) {
    return { allowed: false, reason: 'no_policy_found' };
  }

  if (policy.enabled === false) {
    return { allowed: false, reason: 'agent_disabled' };
  }

  for (const pattern of policy.allowedTools) {
    if (minimatch(tool, pattern)) {
      return { allowed: true };
    }
  }

  return { allowed: false, reason: 'tool_not_in_allowlist' };
}

// ── updatePolicy ─────────────────────────────────────────────────────────────

/**
 * Upsert policy for agentId and invalidate cache.
 * @param {string} agentId
 * @param {object} patch
 * @returns {Promise<object>}
 */
async function updatePolicy(agentId, patch) {
  const updated = await AgentPolicy.findOneAndUpdate(
    { agentId },
    { $set: { ...patch, updatedAt: new Date() } },
    { upsert: true, new: true }
  );

  // Invalidate cache entry
  policyCache.delete(agentId);

  return updated;
}

// ── seedDefaultPolicies ──────────────────────────────────────────────────────

const DEFAULT_POLICIES = {
  analytics: ['salesforce.getLeads', 'servicenow.getIncidents'],
  audience: ['salesforce.getLeads', 'salesforce.getOpportunities'],
  content: ['salesforce.getCases'],
  journey: ['salesforce.getOpportunities', 'servicenow.getChangeRequests'],
};

/**
 * Seed default policies for all four agents if they don't already exist.
 */
async function seedDefaultPolicies() {
  for (const [agentId, allowedTools] of Object.entries(DEFAULT_POLICIES)) {
    const existing = await AgentPolicy.findOne({ agentId });
    if (!existing) {
      await updatePolicy(agentId, {
        allowedTools,
        enabled: true,
        updatedBy: 'system',
      });
    }
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  checkPolicy,
  getPolicy,
  updatePolicy,
  seedDefaultPolicies,
  AgentPolicy,
};
