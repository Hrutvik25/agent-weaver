# Implementation Plan: MCP Agent Gateway

## Overview

Implement MCP (Model Context Protocol) support for the AEP Agent Orchestrator by building a centralized Agent Gateway (:5001), two MCP servers (Salesforce :5002, ServiceNow :5003), embedding an MCP client in each of the four existing agents, and adding a React metrics panel to the dashboard. All security middleware (JWT auth, Policy Engine, Replay Guard, Rate Limiter, Response Sanitizer, Audit Logger, Metrics Collector) is implemented in the Gateway. Implementation language: Node.js (backend) and TypeScript/React (frontend).

## Tasks

- [x] 1. Scaffold Gateway and MCP server directory structure with shared types
  - Create `backend/gateway/` directory with `index.js`, `package.json`
  - Create `backend/mcp-servers/salesforce/` with `index.js`, `package.json`
  - Create `backend/mcp-servers/servicenow/` with `index.js`, `package.json`
  - Define shared `ToolDefinition` registry at `backend/gateway/toolRegistry.js`
  - Define custom error classes `MCPPolicyError`, `MCPRateLimitError`, `MCPError` at `backend/gateway/errors.js`
  - _Requirements: 8.4, 8.5, 8.6, 11.1, 11.2_

- [x] 2. Implement Response Sanitizer
  - [x] 2.1 Implement `ResponseSanitizer.sanitize` in `backend/gateway/sanitizer.js`
    - Deep-traverse response tree; neutralize injection patterns; replace PII with `[REDACTED]`; truncate to `maxBytes`
    - Return `{ data, warnings, truncated }`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  - [ ]* 2.2 Write property test — Property 3: Sanitization Coverage — Injection Neutralization
    - **Property 3**: For any MCP response, no string in sanitized data contains a known injection pattern
    - **Validates: Requirements 5.1, 5.2, 5.7**
  - [ ]* 2.3 Write property test — Property 4: Sanitization Coverage — PII Stripping
    - **Property 4**: For any MCP response, no string in sanitized data contains PII matching defined patterns
    - **Validates: Requirements 5.3, 5.8**
  - [ ]* 2.4 Write property test — Property 5: Response Size Bound
    - **Property 5**: For any response and any `maxBytes > 0`, `byteLength(JSON.stringify(result.data)) <= maxBytes`
    - **Validates: Requirements 5.4, 5.6**

- [x] 3. Implement Policy Engine
  - [x] 3.1 Implement `PolicyEngine` in `backend/gateway/policyEngine.js`
    - `checkPolicy(agentId, tool)`: glob-match tool against `allowedTools`; check `enabled` flag; return `{ allowed, reason }`
    - `getPolicy(agentId)`: fetch from MongoDB with 60-second in-memory cache
    - `updatePolicy(agentId, patch)`: update MongoDB document, invalidate cache entry
    - Seed default deny-all policies at startup for all four agents
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_
  - [ ]* 3.2 Write property test — Property 11: Least Privilege Default
    - **Property 11**: For any newly created `AgentPolicy`, `allowedTools` is `[]` and `enabled` is `false`
    - **Validates: Requirements 2.7, 11.2**
  - [ ]* 3.3 Write property test — Property 12: Policy Determinism
    - **Property 12**: For any `(agentId, tool)` pair, repeated `checkPolicy` calls within cache TTL return the same `allowed` decision
    - **Validates: Requirements 2.1, 2.4**

- [x] 4. Implement Replay Guard and Rate Limiter
  - [x] 4.1 Implement `ReplayGuard.checkNonce` in `backend/gateway/replayGuard.js`
    - Validate `|Date.now() - timestamp| <= 30000`; check Redis set for nonce; store nonce with 120s TTL bucket
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 4.2 Write property test — Property 2: Replay Prevention — Nonce Uniqueness
    - **Property 2**: For any two requests sharing the same nonce within the valid window, exactly one succeeds and the other is rejected with `replay_detected`
    - **Validates: Requirements 3.3, 3.4, 3.5**
  - [x] 4.3 Implement `RateLimiter.check` in `backend/gateway/rateLimiter.js`
    - Redis `INCR`/`EXPIRE` sliding window for per-minute and per-hour counters; return `{ allowed, retryAfterMs }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ]* 4.4 Write property test — Property 6: Rate Limit Enforcement
    - **Property 6**: For any agent in any 1-minute window, allowed calls <= `rateLimitPerMinute`; in any 1-hour window, allowed calls <= `rateLimitPerHour`
    - **Validates: Requirements 4.1, 4.2, 4.5**

- [x] 5. Implement Audit Logger and Metrics Collector
  - [x] 5.1 Implement `AuditLogger.write` in `backend/gateway/auditLogger.js`
    - Define `MCPAuditLog` Mongoose schema; write asynchronously (fire-and-forget); scrub PII from params before write
    - Always set `outcome`, `nonce`, `timestamp`; record `denyReason` on denied calls
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]* 5.2 Write property test — Property 7: Audit Completeness
    - **Property 7**: For any request processed by the Gateway, exactly one `MCPAuditLog` entry exists whose `nonce` matches the request nonce
    - **Validates: Requirements 6.1, 6.2**
  - [ ]* 5.3 Write property test — Property 8: Audit PII Exclusion
    - **Property 8**: For any `MCPAuditLog` entry, the stored `params` field contains no PII matching defined patterns
    - **Validates: Requirements 6.3**
  - [x] 5.4 Implement `MetricsCollector.record` in `backend/gateway/metricsCollector.js`
    - Redis `HINCRBY` on `mcp:metrics:{agentId}:{tool}:{windowKey}` for `calls`, `totalLatencyMs`, `totalTokens`, `totalCostUsd`
    - Set 7-day TTL; increment `errors` counter on failure
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ]* 5.5 Write property test — Property 9: Metrics Consistency
    - **Property 9**: For any agent+tool combination, `calls` counter in Redis equals count of `MCPAuditLog` entries with `outcome: "allowed"`
    - **Validates: Requirements 7.1, 7.2**
  - [ ]* 5.6 Write property test — Property 10: Cost Monotonicity
    - **Property 10**: For any two time points t1 < t2, cumulative `totalCostUsd` at t2 >= cumulative `totalCostUsd` at t1
    - **Validates: Requirements 7.4, 7.5**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Agent Gateway Express service
  - [x] 7.1 Implement JWT authentication middleware in `backend/gateway/authMiddleware.js`
    - Extract Bearer token; verify with `AGENT_JWT_SECRET_{AGENT_ID}` env var; validate `agentId` claim matches request body
    - Return 401 with `missing_token` or `invalid_token` on failure
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [ ]* 7.2 Write property test — Property 13: JWT Authentication — Invalid Token Rejection
    - **Property 13**: For any request with invalid JWT signature or mismatched `agentId` claim, Gateway returns HTTP 401 and does not proceed to policy evaluation
    - **Validates: Requirements 1.3, 1.4**
  - [x] 7.3 Implement `POST /mcp/invoke` route in `backend/gateway/index.js`
    - Wire middleware chain: authMiddleware → replayGuard → policyEngine → rateLimiter → route to MCP server → sanitizer → auditLogger → metricsCollector → respond
    - Return `MCPInvokeResponse` with `{ success, data, meta: { latencyMs, tokensUsed, estimatedCostUsd, auditId } }`
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 11.1, 11.2, 11.3, 11.4, 11.5_
  - [ ]* 7.4 Write property test — Property 1: AuthZ Completeness
    - **Property 1**: For any tool call that reaches an MCP server, `PolicyEngine.checkPolicy` must have returned `allowed: true` for that `agentId`+`tool`
    - **Validates: Requirements 2.1, 2.2**
  - [x] 7.5 Implement `GET /mcp/metrics` and `GET /mcp/audit` routes
    - Metrics: aggregate Redis hashes by window (`1h`, `24h`, `7d`); return `{ perAgent, perTool, totals }`
    - Audit: paginated MongoDB query with `agentId`, `tool`, `from`, `to`, `limit` filters; return PII-scrubbed params
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  - [x] 7.6 Implement `GET /mcp/policy/:agentId` and `PUT /mcp/policy/:agentId` routes
    - GET: return current `AgentPolicy` from MongoDB
    - PUT: validate `agentId` is one of four known agents; update MongoDB; record `updatedBy`; invalidate policy cache
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  - [ ]* 7.7 Write property test — Property 15: Policy Round-Trip Consistency
    - **Property 15**: For any valid policy update via `PUT /mcp/policy/:agentId`, a subsequent `GET /mcp/policy/:agentId` returns a document reflecting all fields from the update
    - **Validates: Requirements 12.2, 12.5**

- [x] 8. Implement MCP Client and embed in agents
  - [x] 8.1 Implement `MCPClient` class in `backend/gateway/mcpClient.js`
    - `invoke(tool, params)`: generate UUID v4 nonce, attach signed JWT, include Unix ms timestamp, POST to Gateway
    - Throw `MCPPolicyError` on 403, `MCPRateLimitError` on 429, `MCPError` on other 4xx/5xx
    - `listTools()`: GET `/mcp/tools` from Gateway and return `ToolDefinition[]`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
  - [ ]* 8.2 Write property test — Property 14: Nonce Uniqueness per MCP_Client Invocation
    - **Property 14**: For any two invocations of `MCPClient.invoke`, the generated nonce values are distinct
    - **Validates: Requirements 8.1**
  - [x] 8.3 Embed `MCPClient` in `AnalyticsAgent` in `backend/server.js`
    - Instantiate with `agentId: 'analytics'` and `AGENT_JWT_SECRET_ANALYTICS`
    - Add `enrichWithMCP` helper calling `salesforce.getLeads` or `servicenow.getIncidents`; catch `MCPPolicyError` gracefully
    - _Requirements: 8.1–8.7, 9.1, 10.1_
  - [x] 8.4 Embed `MCPClient` in `AudienceAgent` in `backend/server.js`
    - Instantiate with `agentId: 'audience'`; add `enrichSegmentWithCRM` calling `salesforce.getLeads` / `salesforce.getOpportunities`
    - _Requirements: 8.1–8.7, 9.1_
  - [x] 8.5 Embed `MCPClient` in `ContentAgent` in `backend/server.js`
    - Instantiate with `agentId: 'content'`; add `fetchSupportContext` calling `salesforce.getCases`
    - _Requirements: 8.1–8.7, 9.1_
  - [x] 8.6 Embed `MCPClient` in `JourneyAgent` in `backend/server.js`
    - Instantiate with `agentId: 'journey'`; add `fetchPipelineContext` calling `salesforce.getOpportunities` and `servicenow.getChangeRequests`
    - _Requirements: 8.1–8.7, 9.1, 10.1_

- [x] 9. Implement Salesforce MCP Server
  - [x] 9.1 Implement `backend/mcp-servers/salesforce/index.js`
    - Register tools: `salesforce.getLeads`, `salesforce.getCases`, `salesforce.getOpportunities`, `salesforce.updateLead`
    - Each handler: validate args against `inputSchema`; call Salesforce REST API; return records or propagate 401
    - Respond with MCP JSON-RPC 2.0 format; listen on port 5002
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 10. Implement ServiceNow MCP Server
  - [x] 10.1 Implement `backend/mcp-servers/servicenow/index.js`
    - Register tools: `servicenow.getIncidents`, `servicenow.getChangeRequests`, `servicenow.getCMDBItem`, `servicenow.createIncident`
    - Each handler: validate args against `inputSchema`; call ServiceNow REST API; return records or propagate 401
    - Respond with MCP JSON-RPC 2.0 format; listen on port 5003
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Add MCP Metrics Panel to React frontend
  - [x] 12.1 Add MCP API helpers to `src/lib/api.ts`
    - Add `mcpApi.metrics(window)`, `mcpApi.audit(params)`, `mcpApi.getPolicy(agentId)`, `mcpApi.updatePolicy(agentId, policy)`
    - _Requirements: 14.1, 14.2, 14.3, 14.4_
  - [x] 12.2 Create `src/components/aep/MCPMetricsPanel.tsx`
    - Display per-agent call counts, total estimated cost (USD), average latency (ms)
    - Display per-tool call counts and error rates
    - Time window selector (1h / 24h / 7d) that triggers re-fetch of `/api/mcp/metrics`
    - Recent audit log table: `agentId`, `tool`, `outcome`, `timestamp`; visually distinguish `denied` rows (red badge)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  - [x] 12.3 Integrate `MCPMetricsPanel` into `src/pages/Index.tsx`
    - Import and render `MCPMetricsPanel` alongside existing agent panels
    - _Requirements: 14.1_

- [~] 13. Update Docker Compose and Nginx configuration
  - [-] 13.1 Add `gateway`, `mcp-salesforce`, `mcp-servicenow` services to `docker-compose.yml`
    - `gateway`: build `backend/gateway/`, port 5001, depends on mongodb + redis, env vars for JWT secrets and `MCP_GATEWAY_URL`
    - `mcp-salesforce`: build `backend/mcp-servers/salesforce/`, port 5002, env vars `SALESFORCE_*`, NOT exposed via Nginx
    - `mcp-servicenow`: build `backend/mcp-servers/servicenow/`, port 5003, env vars `SERVICENOW_*`, NOT exposed via Nginx
    - All three share the existing `aep-network`, `mongodb`, and `redis` services
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_
  - [ ] 13.2 Add `/api/mcp/` location block to `nginx/conf.d/api-gateway.conf`
    - Route `/api/mcp/` to `http://gateway:5001/mcp/` with same proxy headers as existing `/api/` block
    - Place the `/api/mcp/` block before the generic `/api/` block so it takes precedence
    - _Requirements: 11.4, 15.5_

- [~] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use `fast-check` (add as dev dependency in `backend/gateway/package.json`)
- Each property test task references a specific correctness property from the design document
- The existing Kafka pipeline in `backend/server.js` is preserved unchanged; MCP calls are additive side-channel enrichment
- MCP servers use mock/stub Salesforce and ServiceNow clients when credentials are not set (graceful degradation)
- Default agent policies are seeded at Gateway startup; operators can update via `PUT /mcp/policy/:agentId`
