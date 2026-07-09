/**
 * Server Entry Point
 *
 * This module is strictly responsible for binding the configured Express application
 * to a network port and starting the HTTP server.
 *
 * Separating the server initialization from the core Express app configuration (server.js)
 * prevents EADDRINUSE port collisions during automated integration testing.
 */
const app = require('./server')

// Define the port, prioritizing environment variables for production deployments
const PORT = process.env.PORT || 3000

// Initialize the server and begin listening for incoming connections
app.listen(PORT, () => {
  console.log(`🚀 Rate Limiter API running successfully on port ${PORT}`)
})
