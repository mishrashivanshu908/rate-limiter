/**
 * Server Entry Point
 *
 * This module is strictly responsible for binding the configured Express application
 * to a network port and starting the HTTP server.
 *
 * By isolating the network binding from the application configuration (app.js),
 * we ensure the application can be cleanly imported into test suites (like Jest & Supertest)
 * without triggering EADDRINUSE (Address already in use) port collisions during automated CI/CD runs.
 */
const app = require('./app')

// ==========================================
// Server Initialization
// ==========================================

// Define the server port, prioritizing environment variables for production
// deployments (e.g., AWS, Heroku, Docker) and defaulting to 3000 for local development.
const SERVER_PORT = process.env.PORT || 3000

// Bind the application to the specified port and begin listening for incoming connections
app.listen(SERVER_PORT, () => {
  console.log(`🚀 Rate Limiter API running successfully on port ${SERVER_PORT}`)
})
