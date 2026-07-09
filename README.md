# Rate Limiter Middleware

A robust, in-memory rate-limiting middleware for Express.js APIs, built using the Token Bucket algorithm. This project prevents API abuse, ensures fair usage, and handles burst traffic efficiently.

## Setup & Installation

**Prerequisites:** Node.js (v18+)

1. Clone the repository and navigate into the project folder.
2. Install the dependencies:
   npm install
3. Start the server:
   npm start
   The API will be available at `http://localhost:3000`.
4. Run the test suite:
   npm test

## API Endpoints Demonstrated

* `GET /api/general` - Limited to 20 requests per minute.
* `POST /api/submit` - Limited to 5 requests per minute.
* `GET /api/status` - Limited to 60 requests per minute.

## Architecture Thinking & Design Decisions

### 1. Algorithm Choice: Token Bucket
I chose the **Token Bucket** algorithm over the Fixed Window Counter and Sliding Window Log for several key reasons:
* **Memory Efficiency ($O(1)$ Space):** Unlike the Sliding Window Log, which stores an array of timestamps for every request, Token Bucket only requires storing two numeric variables (`tokens` and `lastRefillTime`) per client.
* **Elimination of Boundary Spikes:** The Fixed Window Counter suffers from traffic doubling at window reset boundaries. Token Bucket provides a smooth, continuous allowance of traffic.
* **Support for Bursty Traffic:** It natively allows for short bursts of legitimate traffic (up to the bucket limit) while strictly enforcing the average long-term rate limit.
* **Lazy Evaluation (Non-blocking):** Instead of running an intensive background timer to refill buckets, the algorithm calculates token replenishment dynamically on the spot when a request arrives, optimizing CPU usage on the single-threaded Node.js event loop.

### 2. Extending to Distributed Systems
Currently, this implementation uses an in-memory JavaScript `Map` to track clients. In a multi-server distributed environment (like a microservices architecture), this state would be isolated per server, leading to inconsistent rate limits. 

To support distributed rate limiting:
* **Centralized Store:** I would replace the in-memory `Map` with a high-performance, centralized key-value store like **Redis**. 
* **Atomic Operations:** I would utilize Redis features (like Lua scripting) to ensure that the token check and deduction happen atomically, preventing race conditions when concurrent requests from the same client hit different servers simultaneously.

## AI-Assisted Development

As requested, here is a transparent breakdown of how I utilized AI tools during development:

1. **Which AI tools you used:** Gemini
2. **Example prompts you used:** 
   * "Explain the trade-offs between Fixed Window, Sliding Window, and Token Bucket algorithms for rate limiting."
   * "How do I avoid an EADDRINUSE port conflict when testing an Express server using Supertest and Jest?"
3. **Where AI helped most:** The AI was highly valuable for initial algorithmic brainstorming and debugging the exact syntax required for mocking `req` and `res` objects to test middleware isolation without spinning up the full server.
4. **What you manually corrected or implemented:** I manually structured the express middleware pipeline, implemented the HTTP header logic (`X-RateLimit-Remaining`, `Retry-After`), and managed the project file architecture. I also corrected the test environment configurations to ensure Jest exited cleanly without open asynchronous handles.
5. **How you validated correctness:** I wrote comprehensive unit tests using Jest and Supertest, testing exact N and N+1 boundaries, simulated time delays using `jest.useFakeTimers()`, and ensured 100% of the functional requirements were met.