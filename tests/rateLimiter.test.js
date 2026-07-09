/**
 * Rate Limiter Test Suite
 *
 * This suite uses Supertest for HTTP assertions and Jest's fake timers
 * to simulate the passage of time. This allows us to strictly test time-based
 * rate limiting logic (like bucket replenishment) instantly, without slowing
 * down the test runner.
 */
const request = require('supertest')
const app = require('../src/server')
const rateLimiter = require('../src/rateLimiter')

// Hijack global timers to allow instant fast-forwarding of time
jest.useFakeTimers()

afterAll(() => {
  // Restore standard JavaScript timers to prevent side effects in other test files
  jest.useRealTimers()
})

describe('Token Bucket Rate Limiter Endpoints', () => {
  // Consistent identifier to simulate a single client across multiple requests
  const mockApiKey = 'test-client-api-key'

  describe('POST /api/submit (Limit: 5 requests / 60 seconds)', () => {
    it('1. Should allow requests strictly within the limit (N requests)', async () => {
      // Act: Send the maximum allowed number of requests (5)
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/submit')
          .set('x-api-key', mockApiKey)

        // Assert: Ensure successful processing and correct deduction of tokens
        expect(res.statusCode).toBe(200)
        expect(res.body.message).toBe('OK')
        expect(res.headers['x-ratelimit-remaining']).toBe(String(4 - i))
      }
    })

    it('2. Should block the request that exceeds the limit (N+1 request)', async () => {
      // Arrange: The bucket is currently empty from the previous test.
      // Act: This 6th request should hit the strict rate limit boundary.
      const res = await request(app)
        .post('/api/submit')
        .set('x-api-key', mockApiKey)

      // Assert: Ensure the request is dropped and the client is told to wait
      expect(res.statusCode).toBe(429)
      expect(res.body.error).toBe('Too Many Requests')
      expect(res.headers['retry-after']).toBeDefined()
    })

    it('3. Should reset the window and allow requests after configured time passes', async () => {
      // Arrange: Fast-forward time by 61 seconds to fully replenish the 60-second bucket
      jest.advanceTimersByTime(61000)

      // Act: Send a new request
      const res = await request(app)
        .post('/api/submit')
        .set('x-api-key', mockApiKey)

      // Assert: The request should now succeed with a freshly deducted bucket
      expect(res.statusCode).toBe(200)
      expect(res.headers['x-ratelimit-remaining']).toBe('4')
    })

    it('4. Should reject requests missing a client identifier', () => {
      // For this specific edge case, we test the middleware in isolation rather than
      // via Supertest to cleanly simulate the complete absence of an IP address.

      // Arrange: Mock Request with no headers and undefined IP
      const mockReq = { headers: {} }
      Object.defineProperty(mockReq, 'ip', { get: () => undefined })

      // Arrange: Mock Response spying on status and json methods
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }

      // Arrange: Mock Next to ensure the request doesn't proceed
      const mockNext = jest.fn()

      // Initialize the middleware with the route's specific limits
      const middleware = rateLimiter(5, 60)

      // Act: Execute the middleware directly
      middleware(mockReq, mockRes, mockNext)

      // Assert: Verify the middleware catches the missing ID and halts execution
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Bad Request'),
        }),
      )
      expect(mockNext).not.toHaveBeenCalled()
    })
  })
})
