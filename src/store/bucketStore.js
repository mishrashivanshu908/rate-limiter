/**
 * In-Memory Bucket Store
 *
 * Encapsulates the state management for the rate limiter using a native Map.
 * Isolating the data layer from the middleware ensures Separation of Concerns (SoC)
 * and provides a clear architectural path for migrating to a distributed datastore like Redis.
 *
 * Data Structure: Map<String (Client ID), Object (Tokens & Last Refill Timestamp)>
 */
const clientRateLimitStore = new Map()

// ==========================================
// Memory Management Configuration
// ==========================================
const SWEEP_INTERVAL_MS = 60 * 1000 // Run cleanup every 60 seconds
const EXPIRATION_THRESHOLD_MS = 120 * 1000 // Purge clients inactive for > 120 seconds

/**
 * Retrieves the current token bucket state for a given client.
 * @param {string} clientId - The unique identifier for the client (IP or API key).
 * @returns {Object|undefined} The client's bucket state, or undefined if not found.
 */
const getBucket = (clientId) => clientRateLimitStore.get(clientId)

/**
 * Initializes or updates the token bucket state for a given client.
 * @param {string} clientId - The unique identifier for the client.ww
 * @param {Object} bucketState - The new bucket state { tokens: number, lastRefillTime: number }.
 */
const setBucket = (clientId, bucketState) =>
  clientRateLimitStore.set(clientId, bucketState)

/**
 * Checks if a bucket currently exists for a given client.
 * @param {string} clientId - The unique identifier for the client.
 * @returns {boolean} True if the bucket exists, false otherwise.
 */
const hasBucket = (clientId) => clientRateLimitStore.has(clientId)

/**
 * Memory Leak Prevention: Stale Data Sweeper
 *
 * Periodically iterates through the in-memory store to purge client records
 * that have been inactive beyond the defined expiration threshold.
 */
const staleDataSweeper = setInterval(() => {
  const currentTimeMs = Date.now()

  for (const [clientId, clientBucket] of clientRateLimitStore.entries()) {
    // Check if the time elapsed since the last refill exceeds our threshold
    if (currentTimeMs - clientBucket.lastRefillTime > EXPIRATION_THRESHOLD_MS) {
      clientRateLimitStore.delete(clientId)
    }
  }
}, SWEEP_INTERVAL_MS)

// .unref() removes this background timer from the Node.js event loop reference count.
// This allows the Node process to exit gracefully during automated testing (e.g., Jest)
// rather than hanging indefinitely waiting for the interval to clear.
staleDataSweeper.unref()

module.exports = {
  getBucket,
  setBucket,
  hasBucket,
}
