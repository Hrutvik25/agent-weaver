'use strict';

const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { MCPError, MCPPolicyError, MCPRateLimitError } = require('./errors');

/**
 * MCPClient — used by agents to call the Gateway.
 *
 * @example
 * const client = new MCPClient({
 *   gatewayUrl: 'http://gateway:5001',
 *   agentId: 'analytics',
 *   jwtSecret: process.env.AGENT_JWT_SECRET_ANALYTICS,
 * });
 * const result = await client.invoke('salesforce.getLeads', { filter: { segment: 'enterprise' } });
 */
class MCPClient {
  /**
   * @param {object} options
   * @param {string} options.gatewayUrl  - Base URL of the Gateway, e.g. 'http://gateway:5001'
   * @param {string} options.agentId    - One of 'analytics'|'audience'|'content'|'journey'
   * @param {string} options.jwtSecret  - Secret used to sign JWTs for this agent
   */
  constructor({ gatewayUrl, agentId, jwtSecret }) {
    this.gatewayUrl = gatewayUrl;
    this.agentId = agentId;
    this.jwtSecret = jwtSecret;
  }

  /**
   * Generate a signed JWT for this agent with a 15-minute expiry.
   * @returns {string}
   */
  _generateToken() {
    return jwt.sign(
      { agentId: this.agentId },
      this.jwtSecret,
      { expiresIn: '15m' }
    );
  }

  /**
   * Generate a UUID v4 nonce.
   * @returns {string}
   */
  _generateNonce() {
    return uuidv4();
  }

  /**
   * Invoke a tool via the Gateway.
   *
   * @param {string} tool   - Fully-qualified tool name, e.g. 'salesforce.getLeads'
   * @param {object} params - Tool arguments
   * @returns {Promise<unknown>} The `data` field from the Gateway response
   * @throws {MCPPolicyError}    on HTTP 403
   * @throws {MCPRateLimitError} on HTTP 429
   * @throws {MCPError}          on other 4xx/5xx or network errors
   */
  async invoke(tool, params) {
    const nonce = this._generateNonce();
    const timestamp = Date.now();
    const token = this._generateToken();

    try {
      const response = await axios.post(
        `${this.gatewayUrl}/mcp/invoke`,
        { agentId: this.agentId, tool, params, nonce, timestamp },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.data;
    } catch (err) {
      if (!err.response) {
        // Network error — no response received
        throw new MCPError('Network error: unable to reach Gateway', 503);
      }

      const { status, data } = err.response;
      const message = (data && data.error) || 'mcp_error';

      if (status === 403) {
        throw new MCPPolicyError(message, tool, this.agentId);
      }
      if (status === 429) {
        const retryAfterMs = (data && data.retryAfterMs) || 60000;
        throw new MCPRateLimitError(message, retryAfterMs);
      }
      throw new MCPError(message, status);
    }
  }

  /**
   * List available tools from the Gateway.
   *
   * @returns {Promise<Array<import('./toolRegistry').ToolDefinition>>}
   */
  async listTools() {
    try {
      const response = await axios.get(`${this.gatewayUrl}/mcp/tools`);
      return response.data;
    } catch (err) {
      if (!err.response) {
        throw new MCPError('Network error: unable to reach Gateway', 503);
      }
      const { status, data } = err.response;
      const message = (data && data.error) || 'mcp_error';
      throw new MCPError(message, status);
    }
  }
}

module.exports = MCPClient;
