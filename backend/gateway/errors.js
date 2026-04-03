/**
 * Custom error classes for the MCP Agent Gateway.
 */

/**
 * Base error class for all MCP-related errors.
 */
class MCPError extends Error {
  /**
   * @param {string} message
   * @param {string} [code]
   */
  constructor(message, code) {
    super(message);
    this.name = 'MCPError';
    this.code = code || 'mcp_error';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when the Policy Engine denies a tool call.
 * Carries the tool name and agentId that were denied.
 */
class MCPPolicyError extends MCPError {
  /**
   * @param {string} message
   * @param {string} tool   - The tool that was denied (e.g. "salesforce.getLeads")
   * @param {string} agentId - The agent whose call was denied
   */
  constructor(message, tool, agentId) {
    super(message, 'tool_not_permitted');
    this.name = 'MCPPolicyError';
    this.tool = tool;
    this.agentId = agentId;
  }
}

/**
 * Thrown when the Rate Limiter rejects a call.
 * Carries a hint for when the caller may retry.
 */
class MCPRateLimitError extends MCPError {
  /**
   * @param {string} message
   * @param {number} retryAfterMs - Milliseconds until the caller may retry
   */
  constructor(message, retryAfterMs) {
    super(message, 'rate_limit_exceeded');
    this.name = 'MCPRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

module.exports = { MCPError, MCPPolicyError, MCPRateLimitError };
