/**
 * Express Application Configuration
 *
 * This module sets up the Express application and registers all API routes.
 * It is intentionally decoupled from the server binding logic (e.g., app.listen)
 * to allow isolated, collision-free unit testing using Supertest.
 */
const express = require('express')
const rateLimiter = require('./rateLimiter')

const app = express()

// Middleware to automatically parse incoming JSON payloads
app.use(express.json())

// ==========================================
// API Routes & Rate Limit Policies
// ==========================================

/**
 * General Purpose Endpoint
 * Limit Policy: 20 requests per 60 seconds (1 minute)
 * Use Case: Standard, low-impact data retrieval.
 */
app.get('/api/general', rateLimiter(20, 60), (req, res) => {
  res.json({ message: 'OK' })
})

/**
 * Data Submission Endpoint
 * Limit Policy: 5 requests per 60 seconds (1 minute)
 * Use Case: Restrictive limits for resource-heavy operations like form submissions.
 */
app.post('/api/submit', rateLimiter(5, 60), (req, res) => {
  res.json({ message: 'OK' })
})

/**
 * System Status Endpoint
 * Limit Policy: 60 requests per 60 seconds (1 minute)
 * Use Case: Higher allowance for frequent health checks or client status polling.
 */
app.get('/api/status', rateLimiter(60, 60), (req, res) => {
  res.json({ message: 'OK' })
})

// Export the fully configured application instance
module.exports = app
