'use strict';

const mongoose = require('mongoose');

// PII patterns (same as sanitizer.js)
const PII_PATTERNS = [
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,  // email
  /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,  // phone
  /\b\d{3}-\d{2}-\d{4}\b/g,                               // SSN
  /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,                         // credit card
];

/**
 * Scrub PII from params by JSON stringify → regex replace → JSON parse.
 * @param {unknown} params
 * @returns {unknown}
 */
function scrubPII(params) {
  if (params == null) return params;
  try {
    let str = JSON.stringify(params);
    for (const pattern of PII_PATTERNS) {
      pattern.lastIndex = 0;
      str = str.replace(pattern, '[REDACTED]');
    }
    return JSON.parse(str);
  } catch {
    return params;
  }
}

const MCPAuditLogSchema = new mongoose.Schema({
  auditId:           { type: String, required: true },
  agentId:           { type: String, required: true },
  tool:              { type: String, required: true },
  server:            { type: String, enum: ['salesforce', 'servicenow', 'unknown'] },
  params:            { type: mongoose.Schema.Types.Mixed },
  outcome:           { type: String, required: true, enum: ['allowed', 'denied', 'error'] },
  denyReason:        { type: String },
  httpStatus:        { type: Number },
  latencyMs:         { type: Number, default: 0 },
  tokensUsed:        { type: Number, default: 0 },
  estimatedCostUsd:  { type: Number, default: 0 },
  responseWarnings:  { type: [String] },
  nonce:             { type: String },
  timestamp:         { type: Date, default: Date.now },
});

const MCPAuditLog = mongoose.model('MCPAuditLog', MCPAuditLogSchema);

/**
 * Fire-and-forget audit log write.
 * @param {{ agentId, tool, server, params, outcome, denyReason, httpStatus, latencyMs, tokensUsed, estimatedCostUsd, responseWarnings, nonce }} entry
 * @returns {string} auditId
 */
function write(entry) {
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const doc = new MCPAuditLog({
    auditId,
    agentId:          entry.agentId,
    tool:             entry.tool,
    server:           entry.server || 'unknown',
    params:           scrubPII(entry.params),
    outcome:          entry.outcome,
    denyReason:       entry.denyReason,
    httpStatus:       entry.httpStatus,
    latencyMs:        entry.latencyMs || 0,
    tokensUsed:       entry.tokensUsed || 0,
    estimatedCostUsd: entry.estimatedCostUsd || 0,
    responseWarnings: entry.responseWarnings || [],
    nonce:            entry.nonce,
    timestamp:        new Date(),
  });

  // Fire-and-forget: do not await
  setImmediate(() => {
    doc.save().catch((err) => {
      process.stderr.write(`[AuditLogger] Failed to save audit log: ${err.message}\n`);
    });
  });

  return auditId;
}

module.exports = { write, MCPAuditLog };
