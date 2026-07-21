/**
 * API Router Configuration
 *
 * This module defines the demonstration endpoints and maps the strictly configured
 * Token Bucket rate-limiting middleware to each distinct route.
 */
const express = require('express')
const rateLimiter = require('../middleware/rateLimiter')

const apiRouter = express.Router()

// ==========================================
// Route Definitions & Rate Limit Policies
// ==========================================

/**
 * GET /api/general
 * Description: A general-purpose endpoint[cite: 2].
 * Rate Limit Policy: 20 requests per 60 seconds (minute)[cite: 2].
 */
apiRouter.get('/general', rateLimiter(2, 60), (req, res) => {
  res.json({ message: 'OK' })
})

/**
 * POST /api/submit
 * Description: A form or data submission endpoint[cite: 2].
 * Rate Limit Policy: 5 requests per 60 seconds (minute)[cite: 2].
 */
apiRouter.post('/submit', rateLimiter(5, 60), (req, res) => {
  res.json({ message: 'OK' })
})

/**
 * GET /api/status
 * Description: Returns the caller's current rate limit status[cite: 2].
 * Rate Limit Policy: 60 requests per 60 seconds (minute)[cite: 2].
 */
apiRouter.get('/status', rateLimiter(60, 60), (req, res) => {
  res.json({ message: 'OK' })
})

module.exports = apiRouter
