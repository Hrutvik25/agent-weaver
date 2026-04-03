'use strict';

/**
 * ReplayGuard — prevents replay attacks using Redis nonce sets.
 *
 * Nonces are stored in per-minute buckets with a 120s TTL, covering
 * the current minute and the previous one within the 30s timestamp window.
 */

/**
 * Check whether a nonce is fresh (not replayed) and within the timestamp window.
 *
 * @param {object} redisClient  - ioredis / node-redis client
 * @param {string} nonce        - unique request nonce
 * @param {number} timestamp    - request timestamp in milliseconds (epoch)
 * @returns {Promise<{ fresh: boolean, reason?: string }>}
 */
async function checkNonce(redisClient, nonce, timestamp) {
  // 1. Validate timestamp window (±30 seconds)
  if (Math.abs(Date.now() - timestamp) > 30000) {
    return { fresh: false, reason: 'timestamp_out_of_window' };
  }

  // 2. Compute bucket key (floor to minute)
  const bucketKey = `mcp:nonces:${Math.floor(timestamp / 60000)}`;

  // 3. Check for replay
  const isMember = await redisClient.sIsMember(bucketKey, nonce);
  if (isMember) {
    return { fresh: false, reason: 'replay_detected' };
  }

  // 4. Record nonce
  await redisClient.sAdd(bucketKey, nonce);

  // 5. Set / refresh TTL (120s covers current + previous minute bucket)
  await redisClient.expire(bucketKey, 120);

  return { fresh: true };
}

module.exports = { checkNonce };
