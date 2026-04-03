'use strict';

const INJECTION_PATTERNS = [
  /ignore\s+(previous|all)\s+instructions/i,
  /system\s*:\s*you\s+are/i,
  /\x1b\[/,                        // ANSI escape
  /[\u200b-\u200f\u202a-\u202e]/,  // Unicode direction overrides
  /<\|.*?\|>/,                      // special token delimiters
];

const PII_PATTERNS = [
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,  // email
  /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,  // phone
  /\b\d{3}-\d{2}-\d{4}\b/g,                               // SSN
  /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,                         // credit card
];

/**
 * Recursively walks objects/arrays and applies fn to every string value.
 * @param {unknown} value
 * @param {(s: string) => string} fn
 * @returns {unknown}
 */
function deepTransform(value, fn) {
  if (typeof value === 'string') {
    return fn(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepTransform(item, fn));
  }
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = deepTransform(value[key], fn);
    }
    return result;
  }
  return value;
}

/**
 * Sanitize an MCP server response.
 *
 * @param {unknown} response - Raw response from MCP server
 * @param {{ agentId: string, tool: string, maxBytes: number }} context
 * @returns {{ data: unknown, warnings: string[], truncated: boolean }}
 */
function sanitize(response, context) {
  const { maxBytes } = context;
  const warnings = new Set();
  let truncated = false;

  // Step 1: Size cap
  let serialized = JSON.stringify(response);
  if (serialized !== undefined && Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    // Truncate the serialized string to maxBytes chars and wrap
    const truncatedStr = serialized.slice(0, maxBytes);
    response = { _truncated: true, data: truncatedStr };
    truncated = true;
    warnings.add('response_truncated');
  }

  // Step 2: Injection neutralization
  response = deepTransform(response, (str) => {
    let result = str;
    for (const pattern of INJECTION_PATTERNS) {
      // Reset lastIndex for global patterns (none here, but be safe)
      if (pattern.global) pattern.lastIndex = 0;
      if (pattern.test(result)) {
        warnings.add('injection_neutralized');
        if (pattern.global) pattern.lastIndex = 0;
        result = result.replace(pattern, '');
      }
    }
    return result;
  });

  // Step 3: PII stripping
  response = deepTransform(response, (str) => {
    let result = str;
    for (const pattern of PII_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(result)) {
        warnings.add('pii_stripped');
        pattern.lastIndex = 0;
        result = result.replace(pattern, '[REDACTED]');
      }
    }
    return result;
  });

  return {
    data: response,
    warnings: Array.from(warnings),
    truncated,
  };
}

module.exports = { sanitize };
