const { getBucket, setBucket, hasBucket } = require('../store/bucketStore')

/**
 * Token Bucket Rate Limiting Middleware.
 * Evaluates incoming requests against a dynamically refilling token bucket.
 * Utilizes "lazy evaluation" to calculate token replenishment strictly on-demand.
 *
 * @param {number} maxTokensAllowed - The maximum burst capacity of the bucket.
 * @param {number} windowDurationSeconds - The timeframe over which the bucket fully refills.
 * @returns {Function} Express middleware function.
 */
const rateLimiter = (maxTokensAllowed, windowDurationSeconds) => {
  return (req, res, next) => {
    // Resolve client identity: Prioritize custom API key header, fallback to network IP
    const clientIdentifier = req.headers['x-api-key'] || req.ip

    // Halt execution and reject if no identifier can be resolved
    if (!clientIdentifier) {
      return res
        .status(400)
        .json({ error: 'Bad Request: Missing client identifier' })
    }

    const requestTimestampMs = Date.now()

    // Calculate the exact interval (in milliseconds) required to generate a single token
    const tokenGenerationRateMs =
      (windowDurationSeconds / maxTokensAllowed) * 1000

    // Initialization Phase: Create a fresh bucket for newly observed clients
    if (!hasBucket(clientIdentifier)) {
      setBucket(clientIdentifier, {
        tokens: maxTokensAllowed - 1, // Pre-deduct the token consumed by this initial request
        lastRefillTime: requestTimestampMs,
      })

      // Inject standard rate limit telemetry into the response headers
      res.set({
        'X-RateLimit-Limit': maxTokensAllowed,
        'X-RateLimit-Remaining': maxTokensAllowed - 1,
      })
      return next()
    }

    // Evaluation Phase: Retrieve existing state for known clients
    const currentBucketState = getBucket(clientIdentifier)

    // Calculate the delta since the last recorded bucket modification
    const timeSinceLastRefillMs =
      requestTimestampMs - currentBucketState.lastRefillTime

    // Determine the whole number of tokens generated during the elapsed time
    const generatedTokens = Math.floor(
      timeSinceLastRefillMs / tokenGenerationRateMs,
    )

    // Replenishment Phase: Add newly generated tokens up to the maximum capacity
    if (generatedTokens > 0) {
      currentBucketState.tokens = Math.min(
        maxTokensAllowed,
        currentBucketState.tokens + generatedTokens,
      )

      // Advance the refill timestamp by the exact time consumed to generate these tokens.
      // This preserves fractional milliseconds and prevents drift over multiple rapid requests.
      currentBucketState.lastRefillTime +=
        generatedTokens * tokenGenerationRateMs
    }

    // Authorization Phase: Grant access if the bucket contains at least one token
    if (currentBucketState.tokens > 0) {
      currentBucketState.tokens -= 1 // Consume the token for the current request

      res.set({
        'X-RateLimit-Limit': maxTokensAllowed,
        'X-RateLimit-Remaining': currentBucketState.tokens,
      })
      return next()
    }

    // Rejection Phase: The bucket is empty, deny the request
    // Calculate the precise delay required before exactly one token becomes available
    const secondsUntilNextToken = Math.ceil(
      (tokenGenerationRateMs -
        (requestTimestampMs - currentBucketState.lastRefillTime)) /
        1000,
    )

    res.set({
      'X-RateLimit-Limit': maxTokensAllowed,
      'X-RateLimit-Remaining': 0,
      'Retry-After': secondsUntilNextToken,
    })

    return res.status(429).json({ error: 'Too Many Requests' })
  }
}

module.exports = rateLimiter
