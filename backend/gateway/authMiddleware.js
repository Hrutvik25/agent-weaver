'use strict';

const jwt = require('jsonwebtoken');

/**
 * JWT authentication middleware for the Agent Gateway.
 *
 * 1. Extracts Bearer token from Authorization header.
 * 2. Resolves the JWT secret per-agent via AGENT_JWT_SECRET_{AGENT_ID} env var,
 *    falling back to AGENT_JWT_SECRET or a dev default.
 * 3. Verifies the token and validates the agentId claim matches req.body.agentId.
 * 4. Attaches decoded claims to req.agentClaims and calls next().
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  if (!token) {
    return res.status(401).json({ error: 'missing_token' });
  }

  const agentId = req.body && req.body.agentId;

  // Resolve per-agent secret, falling back to shared secret or dev default
  const secret =
    (agentId && process.env['AGENT_JWT_SECRET_' + agentId.toUpperCase()]) ||
    process.env.AGENT_JWT_SECRET ||
    'dev-secret-change-in-production';

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  if (decoded.agentId !== agentId) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  req.agentClaims = decoded;
  next();
}

module.exports = authMiddleware;
