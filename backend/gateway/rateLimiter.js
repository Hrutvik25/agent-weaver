'use strict';

/**
 * RateLimiter — sliding window counters backed by Redis INCR/EXPIRE.
 *
 * Uses per-minute and per-hour buckets keyed by agentId.
 * TTLs are set only on the first increment so they expire naturally.
 */

/**
 * Check whether an agent is within its rate-limit policy.
 *
 * @param {object} redisClient - ioredis / node-redis client
 * @param {string} agentId     - agent identifier
 * @param {{ rateLimitPerMinute: number, rateLimitPerHour: number }} policy
 * @returns {Promise<{ allowed: boolean, retryAfterMs: number }>}
 */
async function check(redisClient, agentId, policy) {
  const now = Date.now();

  const minuteKey = `mcp:rate:${agentId}:min:${Math.floor(now / 60000)}`;
  const hourKey   = `mcp:rate:${agentId}:hr:${Math.floor(now / 3600000)}`;

  // Increment minute counter; set TTL on first request in this window
  const minuteCount = await redisClient.incr(minuteKey);
  if (minuteCount === 1) {
    await redisClient.expire(minuteKey, 60);
  }

  // Increment hour counter; set TTL on first request in this window
  const hourCount = await redisClient.incr(hourKey);
  if (hourCount === 1) {
    await redisClient.expire(hourKey, 3600);
  }

  // Check minute limit first (shorter retry window)
  if (minuteCount > policy.rateLimitPerMinute) {
    const retryAfterMs = Math.ceil(now / 60000) * 60000 - now;
    return { allowed: false, retryAfterMs };
  }

  // Check hour limit
  if (hourCount > policy.rateLimitPerHour) {
    const retryAfterMs = Math.ceil(now / 3600000) * 3600000 - now;
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true, retryAfterMs: 0 };
}

module.exports = { check };
