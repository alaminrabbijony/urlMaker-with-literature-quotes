# urlMaker-with-literature-quotes
A read-heavy distributed URL redirection system with rate limiting, async analytics, indexed lookups, and scalability considerations

## Server Entry Point (`server.js`)

`server.js` is the application bootstrap layer responsible for startup validation, database verification, and graceful shutdown handling.

### Responsibilities

- **Fail-Fast Environment Validation**  
  Ensures required environment variables (like, `DB_URL`, `PORT`) are present before the app starts.

- **Database Health Check**  
  Verifies PostgreSQL connectivity before accepting HTTP requests.

- **Application Startup**  
  Starts the Express server only after successful configuration and DB validation.

- **Graceful Shutdown**  
  Handles `SIGTERM`, `SIGINT`, and `unhandledRejection` events by:
  1. Stopping new HTTP requests
  2. Waiting for in-flight requests to complete
  3. Closing the PostgreSQL connection pool
  4. Exiting safely

- **Fatal Error Handling**  
  Immediately terminates the process on `uncaughtException` to prevent undefined behavior.

### Design Goal

The file isolates infrastructure concerns from business logic and ensures:

- Deterministic startup
- Safe shutdown
- No orphaned DB connections
- Production-ready lifecycle management
