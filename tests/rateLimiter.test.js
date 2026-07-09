/**
 * Rate Limiter Integration Test Suite
 *
 * This suite utilizes Supertest to simulate HTTP requests against the Express router,
 * and Jest's fake timers to deterministically test time-based rate limit resets
 * without causing slow test execution.
 */
const request = require('supertest')
const app = require('../src/app')
const rateLimiter = require('../src/middleware/rateLimiter')

// Hijack the global system clock to control the passage of time manually
jest.useFakeTimers()

afterAll(() => {
  // Restore the normal system clock after all tests complete
  jest.useRealTimers()
})

describe('Token Bucket Rate Limiter Endpoints', () => {
  // ==========================================
  // Test Suite: POST /api/submit
  // Strict Limit: 5 requests per 60 seconds
  // ==========================================
  describe('POST /api/submit (Limit: 5 requests / 60 seconds)', () => {
    const submitEndpointClientKey = 'client-api-key-submit'

    it('1. Should allow requests strictly within the limit (N requests)', async () => {
      // Simulate N rapid, consecutive valid requests
      for (let requestCount = 0; requestCount < 5; requestCount++) {
        const response = await request(app)
          .post('/api/submit')
          .set('x-api-key', submitEndpointClientKey)

        expect(response.statusCode).toBe(200)
      }
    })

    it('2. Should block the request that exceeds the limit (N+1 request)', async () => {
      // The bucket is now empty from the previous test block
      const response = await request(app)
        .post('/api/submit')
        .set('x-api-key', submitEndpointClientKey)

      expect(response.statusCode).toBe(429)
      expect(response.headers['retry-after']).toBeDefined()
    })

    it('3. Should reset the window and allow requests after configured time passes', async () => {
      // Fast-forward the mocked system clock by 61 seconds to trigger a full bucket refill
      jest.advanceTimersByTime(61000)

      const response = await request(app)
        .post('/api/submit')
        .set('x-api-key', submitEndpointClientKey)

      expect(response.statusCode).toBe(200)
    })

    it('4. Should reject requests missing a client identifier', () => {
      // Bypass Supertest's automatic localhost IP injection by utilizing a mock request object.
      // This strictly tests the middleware's rejection logic when no identity is present.
      const mockRequestObject = { headers: {} }
      Object.defineProperty(mockRequestObject, 'ip', { get: () => undefined })

      const mockResponseObject = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const nextFunctionSpy = jest.fn()

      const configuredMiddleware = rateLimiter(5, 60)
      configuredMiddleware(
        mockRequestObject,
        mockResponseObject,
        nextFunctionSpy,
      )

      expect(mockResponseObject.status).toHaveBeenCalledWith(400)
      expect(nextFunctionSpy).not.toHaveBeenCalled()
    })
  })

  // ==========================================
  // Test Suite: GET /api/general
  // Moderate Limit: 20 requests per 60 seconds
  // ==========================================
  describe('GET /api/general (Limit: 20 requests / 60 seconds)', () => {
    const generalEndpointClientKey = 'client-api-key-general'

    it('1. Should allow requests strictly within the limit (N requests)', async () => {
      for (let requestCount = 0; requestCount < 20; requestCount++) {
        const response = await request(app)
          .get('/api/general')
          .set('x-api-key', generalEndpointClientKey)

        expect(response.statusCode).toBe(200)
      }
    })

    it('2. Should block the request that exceeds the limit (N+1 request)', async () => {
      const response = await request(app)
        .get('/api/general')
        .set('x-api-key', generalEndpointClientKey)

      expect(response.statusCode).toBe(429)
      expect(response.headers['retry-after']).toBeDefined()
    })

    it('3. Should reset the window and allow requests after configured time passes', async () => {
      jest.advanceTimersByTime(61000)

      const response = await request(app)
        .get('/api/general')
        .set('x-api-key', generalEndpointClientKey)

      expect(response.statusCode).toBe(200)
    })

    it('4. Should reject requests missing a client identifier', () => {
      const mockRequestObject = { headers: {} }
      Object.defineProperty(mockRequestObject, 'ip', { get: () => undefined })

      const mockResponseObject = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const nextFunctionSpy = jest.fn()

      const configuredMiddleware = rateLimiter(20, 60)
      configuredMiddleware(
        mockRequestObject,
        mockResponseObject,
        nextFunctionSpy,
      )

      expect(mockResponseObject.status).toHaveBeenCalledWith(400)
      expect(nextFunctionSpy).not.toHaveBeenCalled()
    })
  })

  // ==========================================
  // Test Suite: GET /api/status
  // High Limit: 60 requests per 60 seconds
  // ==========================================
  describe('GET /api/status (Limit: 60 requests / 60 seconds)', () => {
    const statusEndpointClientKey = 'client-api-key-status'

    it('1. Should allow requests strictly within the limit (N requests)', async () => {
      for (let requestCount = 0; requestCount < 60; requestCount++) {
        const response = await request(app)
          .get('/api/status')
          .set('x-api-key', statusEndpointClientKey)

        expect(response.statusCode).toBe(200)
      }
    })

    it('2. Should block the request that exceeds the limit (N+1 request)', async () => {
      const response = await request(app)
        .get('/api/status')
        .set('x-api-key', statusEndpointClientKey)

      expect(response.statusCode).toBe(429)
      expect(response.headers['retry-after']).toBeDefined()
    })

    it('3. Should reset the window and allow requests after configured time passes', async () => {
      jest.advanceTimersByTime(61000)

      const response = await request(app)
        .get('/api/status')
        .set('x-api-key', statusEndpointClientKey)

      expect(response.statusCode).toBe(200)
    })

    it('4. Should reject requests missing a client identifier', () => {
      const mockRequestObject = { headers: {} }
      Object.defineProperty(mockRequestObject, 'ip', { get: () => undefined })

      const mockResponseObject = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const nextFunctionSpy = jest.fn()

      const configuredMiddleware = rateLimiter(60, 60)
      configuredMiddleware(
        mockRequestObject,
        mockResponseObject,
        nextFunctionSpy,
      )

      expect(mockResponseObject.status).toHaveBeenCalledWith(400)
      expect(nextFunctionSpy).not.toHaveBeenCalled()
    })
  })
})
