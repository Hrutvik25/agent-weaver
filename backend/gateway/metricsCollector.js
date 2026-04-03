'use strict';

/**
 * Record a successful tool call in Redis metrics.
 *
 * @param {object} redisClient
 * @param {string} agentId
 * @param {string} tool
 * @param {number} latencyMs
 * @param {number} tokens
 * @param {number} costUsd
 */
async function record(redisClient, agentId, tool, latencyMs, tokens, costUsd) {
  const windowKey = Math.floor(Date.now() / 3600000);
  const key = `mcp:metrics:${agentId}:${tool}:${windowKey}`;

  await redisClient.hIncrBy(key, 'calls', 1);
  await redisClient.hIncrBy(key, 'totalLatencyMs', latencyMs);
  await redisClient.hIncrBy(key, 'totalTokens', tokens);
  // Store cost as integer microdollars to avoid float precision issues
  await redisClient.hIncrBy(key, 'totalCostUsd', Math.round(costUsd * 1000000));
  await redisClient.expire(key, 604800); // 7 days
}

/**
 * Record an error for a tool call in Redis metrics.
 *
 * @param {object} redisClient
 * @param {string} agentId
 * @param {string} tool
 */
async function recordError(redisClient, agentId, tool) {
  const windowKey = Math.floor(Date.now() / 3600000);
  const key = `mcp:metrics:${agentId}:${tool}:${windowKey}`;

  await redisClient.hIncrBy(key, 'errors', 1);
  await redisClient.expire(key, 604800); // 7 days
}

/**
 * Aggregate metrics from Redis for a given time window.
 *
 * @param {object} redisClient
 * @param {'1h'|'24h'|'7d'} window
 * @returns {Promise<{ perAgent: object, perTool: object, totals: { calls: number, costUsd: number, avgLatencyMs: number } }>}
 */
async function getMetrics(redisClient, window = '1h') {
  const bucketCounts = { '1h': 1, '24h': 24, '7d': 168 };
  const numBuckets = bucketCounts[window] || 1;

  const currentBucket = Math.floor(Date.now() / 3600000);
  const minBucket = currentBucket - numBuckets + 1;

  const allKeys = await redisClient.keys('mcp:metrics:*');

  const perAgent = {};
  const perTool = {};
  let totalCalls = 0;
  let totalCostMicro = 0;
  let totalLatencyMs = 0;

  for (const key of allKeys) {
    // key format: mcp:metrics:{agentId}:{tool}:{windowKey}
    const parts = key.split(':');
    // parts: ['mcp', 'metrics', agentId, tool, windowKey]
    if (parts.length < 5) continue;

    const windowKeyVal = parseInt(parts[parts.length - 1], 10);
    if (isNaN(windowKeyVal) || windowKeyVal < minBucket || windowKeyVal > currentBucket) {
      continue;
    }

    const agentId = parts[2];
    // tool may contain dots but not colons, so everything between agentId and windowKey
    const tool = parts.slice(3, parts.length - 1).join(':');

    const hash = await redisClient.hGetAll(key);
    if (!hash) continue;

    const calls = parseInt(hash.calls || '0', 10);
    const errors = parseInt(hash.errors || '0', 10);
    const latency = parseInt(hash.totalLatencyMs || '0', 10);
    const tokens = parseInt(hash.totalTokens || '0', 10);
    const costMicro = parseInt(hash.totalCostUsd || '0', 10);

    // Aggregate per agent
    if (!perAgent[agentId]) {
      perAgent[agentId] = { calls: 0, errors: 0, totalLatencyMs: 0, totalTokens: 0, totalCostUsd: 0 };
    }
    perAgent[agentId].calls += calls;
    perAgent[agentId].errors += errors;
    perAgent[agentId].totalLatencyMs += latency;
    perAgent[agentId].totalTokens += tokens;
    perAgent[agentId].totalCostUsd += costMicro / 1000000;

    // Aggregate per tool
    if (!perTool[tool]) {
      perTool[tool] = { calls: 0, errors: 0, totalLatencyMs: 0, totalTokens: 0, totalCostUsd: 0 };
    }
    perTool[tool].calls += calls;
    perTool[tool].errors += errors;
    perTool[tool].totalLatencyMs += latency;
    perTool[tool].totalTokens += tokens;
    perTool[tool].totalCostUsd += costMicro / 1000000;

    totalCalls += calls;
    totalCostMicro += costMicro;
    totalLatencyMs += latency;
  }

  const costUsd = totalCostMicro / 1000000;
  const avgLatencyMs = totalCalls > 0 ? totalLatencyMs / totalCalls : 0;

  return {
    perAgent,
    perTool,
    totals: { calls: totalCalls, costUsd, avgLatencyMs },
  };
}

module.exports = { record, recordError, getMetrics };
