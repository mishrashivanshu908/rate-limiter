/**
 * Express Application Configuration
 *
 * This module initializes the core Express application and registers all route handlers.
 * It is intentionally isolated from the network binding logic (app.listen) in server.js.
 * This Separation of Concerns (SoC) allows the app to be seamlessly imported into
 * Supertest for isolated unit testing without triggering EADDRINUSE port collisions.
 */
const express = require('express')
const apiRoutes = require('./routes/api')

// Initialize the Express application instance
const app = express()

// ==========================================
// Global Middleware Configuration
// ==========================================

// Automatically parse incoming requests with JSON payloads
app.use(express.json())

// ==========================================
// Route Registration
// ==========================================

// Mount the rate-limited demonstration endpoints under the '/api' prefix
app.use('/api', apiRoutes)

// Export the fully configured application instance for server binding and testing
module.exports = app
