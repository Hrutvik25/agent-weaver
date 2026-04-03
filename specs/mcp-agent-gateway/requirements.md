# Requirements Document

## Introduction

This document defines the requirements for the MCP Agent Gateway feature, which adds Model Context Protocol (MCP) support to the existing AEP Agent Orchestrator. The feature enables the four agents (Analytics, Audience, Content, Journey) to securely invoke external tools and data from Salesforce and ServiceNow through a centralized Agent Gateway that enforces authentication, authorization, rate limiting, replay protection, response sanitization, audit logging, cost tracking, and a policy engine that mitigates the five critical MCP security risks.

The existing Kafka-based event pipeline is preserved unchanged. MCP tool invocation operates as a synchronous side-channel: agents call the Gateway when they need external data enrichment, then continue publishing results to Kafka as before.

## Glossary

- **Agent_Gateway**: The central Express service running on port 5001 that proxies all MCP traffic and enforces security, governance, and observability.
- **MCP_Client**: The thin HTTP client embedded in each agent that handles JWT attachment, nonce generation, and retry logic when invoking the Gateway.
- **Policy_Engine**: The component that evaluates allow/deny decisions for every tool call based on per-agent configuration stored in MongoDB.
- **Replay_Guard**: The component that prevents replay attacks by validating nonces and timestamps on every inbound request.
- **Rate_Limiter**: The component that enforces per-agent per-minute and per-hour call limits using a Redis sliding window.
- **Response_Sanitizer**: The component that neutralizes prompt injection patterns, strips PII, and enforces response size caps before returning data to agents.
- **Audit_Logger**: The component that writes an immutable audit log entry to MongoDB for every request processed by the Gateway.
- **Metrics_Collector**: The component that records per-agent, per-tool call counts, latency, token usage, and cost estimates in Redis.
- **Salesforce_MCP_Server**: The MCP server running on port 5002 that translates MCP JSON-RPC calls into Salesforce REST API calls.
- **ServiceNow_MCP_Server**: The MCP server running on port 5003 that translates MCP JSON-RPC calls into ServiceNow REST API calls.
- **AgentPolicy**: A MongoDB document defining an agent's allowedTools list, rate limits, maxResponseBytes cap, and enabled kill-switch.
- **MCPAuditLog**: A MongoDB document recording the full context of a single MCP tool call invocation.
- **AnalyticsAgent**: The existing agent that consumes raw behavioral events from Kafka and may invoke MCP tools for enrichment.
- **AudienceAgent**: The existing agent that upserts audience segments and may invoke MCP tools to enrich segments with CRM data.
- **ContentAgent**: The existing agent that manages content recommendations and may invoke MCP tools to fetch support case data.
- **JourneyAgent**: The existing agent that creates personalized journeys and may invoke MCP tools to fetch pipeline and change request data.
- **Nonce**: A UUID v4 string that is unique per MCP invocation and used to prevent replay attacks.
- **PII**: Personally Identifiable Information — email addresses, phone numbers, SSNs, and credit card numbers.

---

## Requirements

### Requirement 1: Agent Gateway Authentication

**User Story:** As an agent, I want my MCP tool calls to be authenticated by the Gateway, so that only authorized agents can invoke external tools.

#### Acceptance Criteria

1. WHEN an agent sends a POST /mcp/invoke request with a valid Bearer JWT whose agentId claim matches the request body agentId, THE Agent_Gateway SHALL authenticate the request and proceed to policy evaluation.
2. IF a POST /mcp/invoke request is received without a Bearer token in the Authorization header, THEN THE Agent_Gateway SHALL return HTTP 401 with error code "missing_token".
3. IF a POST /mcp/invoke request contains a JWT with an invalid signature, THEN THE Agent_Gateway SHALL return HTTP 401 with error code "invalid_token".
4. IF the agentId claim in the JWT does not match the agentId field in the request body, THEN THE Agent_Gateway SHALL return HTTP 401 with error code "invalid_token".
5. THE Agent_Gateway SHALL support per-agent JWT secrets configured via environment variables in the format AGENT_JWT_SECRET_{AGENT_ID}.

---

### Requirement 2: Policy Engine — Tool Authorization

**User Story:** As a system operator, I want each agent to have an explicit allowlist of permitted tools, so that agents cannot invoke tools outside their functional scope.

#### Acceptance Criteria

1. WHEN a tool call is received, THE Policy_Engine SHALL evaluate the agentId and tool name against the agent's allowedTools list before forwarding the call to any MCP server.
2. IF a tool name does not match any glob pattern in the agent's allowedTools list, THEN THE Policy_Engine SHALL return a DENY decision with reason "tool_not_in_allowlist" and THE Agent_Gateway SHALL return HTTP 403 with error code "tool_not_permitted".
3. IF an agent's AgentPolicy has enabled set to false, THEN THE Policy_Engine SHALL return a DENY decision with reason "agent_disabled" for all tool calls from that agent.
4. THE Policy_Engine SHALL cache AgentPolicy documents with a TTL of 60 seconds to avoid a MongoDB round-trip on every call.
5. WHEN an AgentPolicy is updated, THE Policy_Engine SHALL apply the updated policy within 60 seconds for all subsequent requests.
6. WHEN a tool call is denied, THE Audit_Logger SHALL record the denial with the agentId, tool name, and deny reason before THE Agent_Gateway returns the 403 response.
7. THE Policy_Engine SHALL default a newly created AgentPolicy to allowedTools equal to an empty list and enabled equal to false.

---

### Requirement 3: Replay Attack Prevention

**User Story:** As a system operator, I want every MCP request to include a unique nonce and a fresh timestamp, so that captured requests cannot be replayed to trigger unintended actions.

#### Acceptance Criteria

1. WHEN a POST /mcp/invoke request is received, THE Replay_Guard SHALL validate that the absolute difference between the request timestamp and server time is less than or equal to 30000 milliseconds.
2. IF the absolute difference between the request timestamp and server time exceeds 30000 milliseconds, THEN THE Replay_Guard SHALL cause THE Agent_Gateway to return HTTP 400 with error code "timestamp_out_of_window".
3. WHEN a nonce is received that has already been used within the current time bucket, THE Replay_Guard SHALL cause THE Agent_Gateway to return HTTP 400 with error code "replay_detected".
4. THE Replay_Guard SHALL store used nonces in a Redis set keyed by the floored minute of the request timestamp, with a TTL of 120 seconds.
5. WHEN a nonce is used for the first time within a valid timestamp window, THE Replay_Guard SHALL record the nonce in Redis and allow the request to proceed.

---

### Requirement 4: Rate Limiting

**User Story:** As a system operator, I want per-agent rate limits enforced at the Gateway, so that no single agent can exhaust external API quotas or exfiltrate bulk data.

#### Acceptance Criteria

1. WHEN an agent's call count in the current minute exceeds the rateLimitPerMinute value in its AgentPolicy, THE Rate_Limiter SHALL cause THE Agent_Gateway to return HTTP 429 with error code "rate_limit_exceeded".
2. WHEN an agent's call count in the current hour exceeds the rateLimitPerHour value in its AgentPolicy, THE Rate_Limiter SHALL cause THE Agent_Gateway to return HTTP 429 with error code "rate_limit_exceeded".
3. THE Rate_Limiter SHALL use Redis INCR and EXPIRE commands to implement the sliding window counters atomically.
4. THE Agent_Gateway SHALL include a retryAfterMs field in the HTTP 429 response body to indicate when the agent may retry.
5. THE Rate_Limiter SHALL apply both the per-minute and per-hour limits independently; exceeding either limit SHALL trigger a 429 response.

---

### Requirement 5: Response Sanitization

**User Story:** As a system operator, I want all MCP server responses sanitized before they reach agents, so that prompt injection payloads and PII cannot propagate into agent processing.

#### Acceptance Criteria

1. WHEN an MCP server response is received, THE Response_Sanitizer SHALL scan all string values in the response tree for prompt injection patterns before returning data to the calling agent.
2. WHEN a string value in the response matches a prompt injection pattern, THE Response_Sanitizer SHALL neutralize the pattern by stripping or escaping it and SHALL add "injection_neutralized" to the warnings array.
3. WHEN a string value in the response matches a PII pattern (email address, phone number, SSN, or credit card number), THE Response_Sanitizer SHALL replace the matched value with "[REDACTED]" and SHALL add "pii_stripped" to the warnings array.
4. WHEN the serialized byte length of the response exceeds the maxResponseBytes value in the agent's AgentPolicy, THE Response_Sanitizer SHALL truncate the response to fit within maxResponseBytes and SHALL add "response_truncated" to the warnings array.
5. THE Response_Sanitizer SHALL return a SanitizedResponse containing the cleaned data, a warnings array listing all transformations applied, and a truncated boolean flag.
6. THE Response_Sanitizer SHALL guarantee that the byte length of the serialized sanitized data does not exceed the maxResponseBytes limit for any input.
7. THE Response_Sanitizer SHALL guarantee that no string value in the returned data contains a known prompt injection pattern after sanitization.
8. THE Response_Sanitizer SHALL guarantee that no string value in the returned data contains PII matching the defined patterns after sanitization.

---

### Requirement 6: Audit Logging

**User Story:** As a system operator, I want an immutable audit trail of every MCP tool call, so that I can investigate security incidents and verify compliance.

#### Acceptance Criteria

1. WHEN any POST /mcp/invoke request is processed by THE Agent_Gateway, THE Audit_Logger SHALL write an MCPAuditLog entry to MongoDB regardless of whether the outcome is allowed, denied, or error.
2. THE Audit_Logger SHALL record the following fields in every MCPAuditLog entry: auditId, agentId, tool, server, outcome, httpStatus, latencyMs, tokensUsed, estimatedCostUsd, responseWarnings, nonce, and timestamp.
3. THE Audit_Logger SHALL store a PII-scrubbed copy of the request params in the MCPAuditLog entry, replacing PII values with "[REDACTED]" before writing.
4. THE Audit_Logger SHALL write audit entries in an append-only manner; THE Agent_Gateway SHALL not expose any API endpoint that updates or deletes audit log entries.
5. WHEN a tool call is denied, THE Audit_Logger SHALL record the denyReason field in the MCPAuditLog entry.
6. THE Audit_Logger SHALL perform audit writes asynchronously so that audit log write latency does not block the response path to the calling agent.

---

### Requirement 7: Metrics Collection

**User Story:** As a system operator, I want per-agent and per-tool metrics collected in real time, so that I can monitor usage, cost, and performance of MCP tool calls.

#### Acceptance Criteria

1. WHEN a tool call completes successfully, THE Metrics_Collector SHALL atomically increment the calls, totalLatencyMs, totalTokens, and totalCostUsd counters in the Redis hash keyed by mcp:metrics:{agentId}:{tool}:{windowKey}.
2. WHEN a tool call results in an error, THE Metrics_Collector SHALL atomically increment the errors counter in the corresponding Redis hash.
3. THE Metrics_Collector SHALL set or refresh the TTL of each metrics Redis key to 7 days on every write.
4. THE Metrics_Collector SHALL estimate token usage based on the tool's estimatedTokensPerCall value from the ToolDefinition registry.
5. THE Metrics_Collector SHALL estimate cost in USD by multiplying tokensUsed by the tool's costPerToken value from the ToolDefinition registry.

---

### Requirement 8: MCP Client Integration in Agents

**User Story:** As an agent developer, I want a thin MCP client embedded in each agent, so that agents can invoke Gateway-proxied tools without duplicating authentication and retry logic.

#### Acceptance Criteria

1. THE MCP_Client SHALL generate a unique UUID v4 nonce for each invocation of the invoke method.
2. THE MCP_Client SHALL attach a signed JWT Bearer token to every outbound request to the Agent_Gateway.
3. THE MCP_Client SHALL include the current Unix millisecond timestamp in every outbound request body.
4. WHEN THE Agent_Gateway returns HTTP 403, THE MCP_Client SHALL throw an MCPPolicyError containing the tool name and agentId.
5. WHEN THE Agent_Gateway returns HTTP 429, THE MCP_Client SHALL throw an MCPRateLimitError containing the retryAfterMs value from the response.
6. WHEN THE Agent_Gateway returns any other 4xx or 5xx status, THE MCP_Client SHALL throw an MCPError containing the HTTP status code and error message.
7. THE MCP_Client SHALL expose a listTools method that returns the list of ToolDefinition objects available through the Gateway.

---

### Requirement 9: Salesforce MCP Server

**User Story:** As an agent, I want to query Salesforce CRM data through a standardized MCP interface, so that I can enrich audience segments and journeys with lead and opportunity data.

#### Acceptance Criteria

1. THE Salesforce_MCP_Server SHALL expose the following tools via MCP JSON-RPC 2.0: salesforce.getLeads, salesforce.getCases, salesforce.getOpportunities, and salesforce.updateLead.
2. WHEN a tools/call request is received for salesforce.getLeads, THE Salesforce_MCP_Server SHALL query the Salesforce REST API and return matching Lead records.
3. WHEN a tools/call request is received for salesforce.getCases, THE Salesforce_MCP_Server SHALL query the Salesforce REST API and return matching Case records.
4. WHEN a tools/call request is received for salesforce.getOpportunities, THE Salesforce_MCP_Server SHALL query the Salesforce REST API and return matching Opportunity records.
5. WHEN a tools/call request is received for salesforce.updateLead, THE Salesforce_MCP_Server SHALL update the specified Lead record via the Salesforce REST API.
6. IF the Salesforce REST API returns an authentication error, THEN THE Salesforce_MCP_Server SHALL return HTTP 401 to the Agent_Gateway.
7. THE Salesforce_MCP_Server SHALL validate all inbound tool arguments against the tool's inputSchema before forwarding to the Salesforce REST API.

---

### Requirement 10: ServiceNow MCP Server

**User Story:** As an agent, I want to query ServiceNow ITSM data through a standardized MCP interface, so that I can incorporate incident and change request context into journeys and analytics.

#### Acceptance Criteria

1. THE ServiceNow_MCP_Server SHALL expose the following tools via MCP JSON-RPC 2.0: servicenow.getIncidents, servicenow.getChangeRequests, servicenow.getCMDBItem, and servicenow.createIncident.
2. WHEN a tools/call request is received for servicenow.getIncidents, THE ServiceNow_MCP_Server SHALL query the ServiceNow REST API and return matching Incident records.
3. WHEN a tools/call request is received for servicenow.getChangeRequests, THE ServiceNow_MCP_Server SHALL query the ServiceNow REST API and return matching Change Request records.
4. WHEN a tools/call request is received for servicenow.getCMDBItem, THE ServiceNow_MCP_Server SHALL query the ServiceNow REST API and return the specified Configuration Item record.
5. WHEN a tools/call request is received for servicenow.createIncident, THE ServiceNow_MCP_Server SHALL create a new Incident record via the ServiceNow REST API and return the created record.
6. IF the ServiceNow REST API returns an authentication error, THEN THE ServiceNow_MCP_Server SHALL return HTTP 401 to the Agent_Gateway.
7. THE ServiceNow_MCP_Server SHALL validate all inbound tool arguments against the tool's inputSchema before forwarding to the ServiceNow REST API.

---

### Requirement 11: Gateway Routing and Proxy

**User Story:** As a system operator, I want the Agent Gateway to correctly route tool calls to the appropriate MCP server, so that agents do not need to know which backend server handles each tool.

#### Acceptance Criteria

1. WHEN a tool call passes all security checks, THE Agent_Gateway SHALL route the call to the Salesforce_MCP_Server for tools prefixed with "salesforce." and to the ServiceNow_MCP_Server for tools prefixed with "servicenow.".
2. IF a tool name does not match any registered server prefix, THEN THE Agent_Gateway SHALL return HTTP 404 with error code "unknown_tool".
3. IF the target MCP server is unavailable, THEN THE Agent_Gateway SHALL return HTTP 503 with error code "mcp_server_unavailable" and the server name.
4. THE Agent_Gateway SHALL be reachable from the existing Nginx reverse proxy at the path prefix /api/mcp/*.
5. THE Agent_Gateway SHALL include in every successful MCPInvokeResponse the fields: success, data, and a meta object containing latencyMs, tokensUsed, estimatedCostUsd, and auditId.

---

### Requirement 12: Policy Management API

**User Story:** As a system operator, I want to read and update agent policies through a REST API, so that I can adjust tool allowlists, rate limits, and kill-switches without redeploying the service.

#### Acceptance Criteria

1. WHEN a GET /mcp/policy/:agentId request is received, THE Agent_Gateway SHALL return the current AgentPolicy document for the specified agent from MongoDB.
2. WHEN a PUT /mcp/policy/:agentId request is received with a valid policy payload, THE Agent_Gateway SHALL update the AgentPolicy document in MongoDB and return the updated policy.
3. THE Agent_Gateway SHALL validate that the agentId in a PUT /mcp/policy/:agentId request is one of the four known agents: analytics, audience, content, or journey.
4. WHEN a policy update sets enabled to false, THE Policy_Engine SHALL deny all subsequent tool calls from that agent within 60 seconds.
5. THE Agent_Gateway SHALL record the updatedBy field in the AgentPolicy document on every policy update.

---

### Requirement 13: Metrics and Audit Dashboard API

**User Story:** As a system operator, I want to query aggregated MCP metrics and audit logs through a REST API, so that the frontend dashboard can display real-time usage, cost, and security events.

#### Acceptance Criteria

1. WHEN a GET /mcp/metrics request is received, THE Agent_Gateway SHALL return aggregated metrics from Redis including perAgent totals, perTool totals, and overall totals for calls, costUsd, and avgLatencyMs.
2. THE Agent_Gateway SHALL support a window query parameter on GET /mcp/metrics accepting values "1h", "24h", and "7d" to filter the aggregation time window.
3. WHEN a GET /mcp/audit request is received, THE Agent_Gateway SHALL return paginated MCPAuditLog entries from MongoDB.
4. THE Agent_Gateway SHALL support agentId, tool, from, to, and limit query parameters on GET /mcp/audit to filter and paginate results.
5. THE Agent_Gateway SHALL return audit log entries with PII-scrubbed params fields; raw params SHALL NOT be exposed through the audit API.

---

### Requirement 14: MCP Metrics Panel on Frontend Dashboard

**User Story:** As a system operator, I want an MCP Metrics Panel on the React dashboard, so that I can monitor tool call activity, costs, and security events in real time.

#### Acceptance Criteria

1. THE Dashboard SHALL display an MCP Metrics Panel showing per-agent call counts, total estimated cost in USD, and average latency in milliseconds.
2. THE Dashboard SHALL display per-tool call counts and error rates in the MCP Metrics Panel.
3. WHEN the operator selects a time window (1h, 24h, or 7d), THE Dashboard SHALL refresh the MCP Metrics Panel by calling GET /api/mcp/metrics with the selected window parameter.
4. THE Dashboard SHALL display recent audit log entries in the MCP Metrics Panel, showing agentId, tool, outcome, and timestamp for each entry.
5. WHEN an MCP call results in a denied outcome, THE Dashboard SHALL visually distinguish the denied entry from allowed entries in the audit log display.

---

### Requirement 15: Infrastructure and Configuration

**User Story:** As a system operator, I want the MCP services deployed as Docker containers alongside the existing backend, so that the system can be started with a single docker-compose command.

#### Acceptance Criteria

1. THE Agent_Gateway SHALL run as a separate Docker service on port 5001 defined in the docker-compose configuration.
2. THE Salesforce_MCP_Server SHALL run as a separate Docker service on port 5002 defined in the docker-compose configuration.
3. THE ServiceNow_MCP_Server SHALL run as a separate Docker service on port 5003 defined in the docker-compose configuration.
4. THE Agent_Gateway, Salesforce_MCP_Server, and ServiceNow_MCP_Server SHALL share the existing MongoDB and Redis instances defined in the docker-compose configuration.
5. THE Salesforce_MCP_Server and ServiceNow_MCP_Server SHALL NOT be exposed through Nginx; only THE Agent_Gateway SHALL be reachable via the Nginx reverse proxy.
6. THE Agent_Gateway SHALL read per-agent JWT secrets from environment variables named AGENT_JWT_SECRET_ANALYTICS, AGENT_JWT_SECRET_AUDIENCE, AGENT_JWT_SECRET_CONTENT, and AGENT_JWT_SECRET_JOURNEY.
7. THE Salesforce_MCP_Server SHALL read Salesforce credentials from environment variables SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, and SALESFORCE_INSTANCE_URL.
8. THE ServiceNow_MCP_Server SHALL read ServiceNow credentials from environment variables SERVICENOW_INSTANCE_URL, SERVICENOW_USERNAME, and SERVICENOW_PASSWORD.
