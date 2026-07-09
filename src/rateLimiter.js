/**
 * In-memory key-value store to track client rate limit states.
 * Maps a client identifier (IP or API key) to their respective token bucket.
 * Structure: Map<String, { tokens: Number, lastRefillTime: Number }>
 */
const clientRateLimitStore = new Map()

/**
 * Token Bucket Rate Limiting Middleware.
 * Utilizes a "lazy refill" strategy to replenish tokens dynamically on incoming requests,
 * avoiding the need for continuous background timers per client.
 *
 * @param {number} limit - Maximum number of requests allowed per time window.
 * @param {number} windowSizeInSeconds - The time window duration in seconds.
 * @returns {Function} Express middleware function.
 */
const rateLimiter = (limit, windowSizeInSeconds) => {
  return (req, res, next) => {
    // Resolve client identity: Prioritize API key header, fallback to IP address
    const clientId = req.headers['x-api-key'] || req.ip

    // Block requests that lack a valid identifier
    if (!clientId) {
      return res
        .status(400)
        .json({ error: 'Bad Request: Missing client identifier' })
    }

    const currentTimeMs = Date.now()
    // Calculate the rate of token generation in milliseconds per token
    const msPerToken = (windowSizeInSeconds / limit) * 1000

    // Initialization: If this is the client's first request, provision a new bucket
    if (!clientRateLimitStore.has(clientId)) {
      clientRateLimitStore.set(clientId, {
        tokens: limit - 1, // Deduct 1 token for the current request being processed
        lastRefillTime: currentTimeMs,
      })

      res.set({
        'X-RateLimit-Limit': limit,
        'X-RateLimit-Remaining': limit - 1,
      })
      return next()
    }

    // Retrieve existing bucket state for the client
    const clientBucket = clientRateLimitStore.get(clientId)

    // Lazy Evaluation: Calculate how much time has passed since the last refill
    const elapsedTimeMs = currentTimeMs - clientBucket.lastRefillTime

    // Determine how many full tokens have been generated during the elapsed time
    const newTokensToGrant = Math.floor(elapsedTimeMs / msPerToken)

    // Replenish tokens if enough time has passed
    if (newTokensToGrant > 0) {
      // Add generated tokens, capping at the maximum configured limit
      clientBucket.tokens = Math.min(
        limit,
        clientBucket.tokens + newTokensToGrant,
      )

      // Advance the last refill time by the exact duration used to generate those tokens.
      // This preserves fractional time and prevents drift over multiple requests.
      clientBucket.lastRefillTime += newTokensToGrant * msPerToken
    }

    // Grant access if tokens are available
    if (clientBucket.tokens > 0) {
      clientBucket.tokens -= 1 // Consume one token for this request

      res.set({
        'X-RateLimit-Limit': limit,
        'X-RateLimit-Remaining': clientBucket.tokens,
      })
      return next()
    }

    // Deny access: Bucket is empty
    // Calculate the precise number of seconds until the next single token is fully generated
    const retryAfterSeconds = Math.ceil(
      (msPerToken - (currentTimeMs - clientBucket.lastRefillTime)) / 1000,
    )

    res.set({
      'X-RateLimit-Limit': limit,
      'X-RateLimit-Remaining': 0,
      'Retry-After': retryAfterSeconds,
    })

    return res.status(429).json({ error: 'Too Many Requests' })
  }
}

/**
 * Memory Leak Prevention: Stale Data Cleanup
 * Runs periodically to sweep the store and remove inactive client records.
 * The timer is unreferenced to allow the Node process to exit gracefully during automated testing.
 */
const staleDataSweeper = setInterval(() => {
  const currentTimeMs = Date.now()

  // Iterate through all tracked clients
  for (const [clientId, clientBucket] of clientRateLimitStore.entries()) {
    // If a client has been completely inactive for over 120 seconds, purge their record
    if (currentTimeMs - clientBucket.lastRefillTime > 120000) {
      clientRateLimitStore.delete(clientId)
    }
  }
}, 60000) // Execute sweep every 60 seconds

staleDataSweeper.unref()

module.exports = rateLimiter
