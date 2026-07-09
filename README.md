# Rate Limiter Middleware — Case Study

A from-scratch Node.js/Express rate limiting middleware implemented using the **Token Bucket** algorithm.

## Table of Contents

- [Setup & Run Instructions](#setup--run-instructions)
- [Project Structure](#project-structure)
- [Demo Endpoints](#demo-endpoints)
- [Algorithm Choice & Design Decisions](#algorithm-choice--design-decisions)
- [Architecture Thinking](#architecture-thinking)
- [AI-Assisted Development](#ai-assisted-development)
- [Testing](#testing)

## Setup & Run Instructions

### Prerequisites
- Node.js v18+
- npm

### Installation
```bash
npm install
```

### Run the server
```bash
npm start
```
The server will start on `http://localhost:3000` by default.

### Run tests
```bash
npm test
```

## Project Structure

```
├── src/
│   ├── middleware/
│   │   └── rateLimiter.js      # Core token bucket middleware (reusable)
│   ├── store/
│   │   └── bucketStore.js      # In-memory store + cleanup logic
│   ├── routes/
│   │   └── api.js              # Demo endpoints
│   └── app.js                  # Express app setup
├── tests/
│   └── rateLimiter.test.js     # Jest unit tests
├── README.md
└── package.json
```

## Demo Endpoints

| Endpoint | Description | Rate Limit |
|---|---|---|
| `GET /api/general` | General-purpose endpoint | 20 requests / minute |
| `POST /api/submit` | Form/data submission endpoint | 5 requests / minute |
| `GET /api/status` | Returns caller's current rate limit status | 60 requests / minute |

Every response includes the following headers:
- `X-RateLimit-Limit` — configured max requests
- `X-RateLimit-Remaining` — requests remaining in the current window
- `Retry-After` — seconds until the bucket has enough tokens again (included on 429 responses)

A client is identified either by IP address or by an `x-api-key` header (simulated API key). A missing or invalid API key (when header-based identity is used) returns `HTTP 400`.

## Algorithm Choice & Design Decisions

### Why Token Bucket?

I implemented the **Token Bucket** algorithm over Fixed Window Counter and Sliding Window Log for the following reasons:

1. **Smooths out bursts without being overly rigid.** Unlike a Fixed Window Counter, which can allow up to 2x the intended limit right at a window boundary (e.g. a burst at the end of one window followed immediately by a burst at the start of the next), Token Bucket enforces a steady, predictable rate over time while still allowing short bursts up to the bucket capacity.
2. **Memory efficient compared to Sliding Window Log.** A Sliding Window Log has to store a timestamp for every request per client, which grows with traffic volume. Token Bucket only needs to store two values per client — current token count and last refill timestamp — making it O(1) in space per client regardless of request volume.
3. **Simple, deterministic refill math.** Tokens are refilled lazily (computed on each request based on elapsed time) rather than via a background timer, which keeps the implementation simple and avoids extra scheduling overhead.

### How it works
- Each client gets a bucket with a maximum capacity equal to `limit`.
- Tokens are added to the bucket at a constant rate: `limit / windowSizeInSeconds` tokens per second.
- On each request, the bucket is refilled based on elapsed time since the last check (capped at capacity), then one token is consumed if available.
- If no tokens are available, the request is rejected with `429` and a `Retry-After` value computed from how long until the next token is available.
- Boundary behavior (Nth vs N+1th request) is explicitly covered in the test suite — the Nth request is allowed (bucket hits zero), and the N+1th is rejected until a token regenerates.

### Trade-offs: Fixed Window vs Sliding Window (optional section)
- **Fixed Window Counter** is the simplest and cheapest to implement, but suffers from the boundary burst problem described above. It's a reasonable choice when strict precision isn't critical and simplicity/performance matter most.
- **Sliding Window Log** is the most accurate — it tracks exact request timestamps — but is the most memory-intensive since it stores a log per client.
- **Token Bucket** (chosen here) sits in between: it avoids the boundary burst issue of Fixed Window while staying far more memory-efficient than Sliding Window Log, at the cost of slightly more complex refill logic.

## Architecture Thinking

### Extending to distributed rate limiting

The current implementation uses an in-memory `Map`, which only works correctly for a single server instance — each instance would maintain its own independent bucket state, effectively multiplying the real limit by the number of instances.

To extend this to a distributed setup across multiple server instances, I would:

1. **Move the bucket state to a shared, centralized store** such as Redis, so all instances read/write the same state instead of keeping local counters.
2. **Use atomic operations** (e.g. Redis `EVAL` with a Lua script, or `INCR`/`MULTI`) to perform the "refill + consume" check as a single atomic operation, avoiding race conditions when multiple instances hit the same client's bucket simultaneously.
3. **Set a TTL on each client's key** equal to the window size so stale entries expire automatically, removing the need for manual in-process cleanup.
4. **Keep the middleware interface unchanged** — the store would be swapped out behind the same interface (`getBucket`, `updateBucket`) used by the in-memory version, so the rate-limiting logic itself doesn't need to change, only the storage layer.

### In-memory cleanup

To avoid unbounded memory growth from clients that stop sending requests, a periodic cleanup routine sweeps the store and removes entries whose buckets are full (i.e., fully refilled/idle) and haven't been touched within a defined TTL.

## AI-Assisted Development

I used AI assistance (Claude/ChatGPT-style tools) throughout this assignment, primarily for two purposes:

### 1. Comparing rate limiting algorithms
Before implementation, I used AI to walk through the trade-offs between Fixed Window Counter, Sliding Window Log, and Token Bucket — specifically around memory usage, burst behavior, and implementation complexity. This comparison directly informed my decision to go with Token Bucket, as summarized in the [Algorithm Choice](#algorithm-choice--design-decisions) section above.

Example prompt used:
> "Compare Fixed Window, Sliding Window Log, and Token Bucket rate limiting algorithms for a Node.js middleware — focus on memory usage per client and behavior at window boundaries."

### 2. Debugging
AI was most helpful for debugging edge cases in the refill math (e.g. floating-point drift in elapsed-time calculations, and off-by-one issues at the exact limit boundary — the Nth vs N+1th request). It helped me trace through a failing test where the bucket wasn't refilling correctly between test runs due to a stale `lastRefill` timestamp.

Example prompt used:
> "This test fails intermittently — the bucket shows 0 tokens even after the window should have passed. Here's my refill function and the test, what's going wrong?"

### Where AI helped most
- Talking through algorithm trade-offs before writing any code
- Spotting the root cause of a timing-related bug in the refill logic
- Suggesting edge cases I hadn't thought to test (e.g. exact boundary requests, clock precision)

### What I manually corrected or implemented
- Wrote and structured the core middleware, store, and route logic myself
- Adjusted AI-suggested refill calculations to use `Date.now()` consistently and avoid drift
- Rewrote generated test cases to match my actual middleware's response format and header names
- Verified header values (`X-RateLimit-Remaining`, `Retry-After`) matched the assignment spec exactly, since initial AI suggestions used slightly different header names

### How I validated correctness
- Ran the full Jest test suite (`npm test`) covering: requests within limit passing through, requests over the limit being blocked with 429, and window/bucket state resetting correctly over time
- Manually tested boundary behavior (Nth request allowed, N+1th rejected) using repeated `curl` requests against a running local server
- Manually inspected response headers using `curl -i` to confirm `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` were present and correct on both successful and rate-limited responses

## Testing

The Jest test suite (`tests/rateLimiter.test.js`) covers:
- Requests within the configured limit pass through successfully
- Requests exceeding the limit return `429` with a `Retry-After` header
- Bucket/window state resets correctly after the configured time window elapses
- Boundary conditions: the Nth request succeeds, the N+1th request is blocked
- Missing/invalid API key returns `400` when header-based identity is used

Test output is included in the submission as a screenshot/log per the assignment instructions.
