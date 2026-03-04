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

## Application Layer (`app.js`)

`app.js` configures the Express application, global middleware, routing, and error handling.  
It is responsible for request processing, security hardening, and API pipeline structure.

---

### Core Responsibilities

- **Security Middleware**
  - `helmet` for HTTP security headers
  - `cors` for cross-origin handling
  - `hpp` to prevent HTTP parameter pollution
  - `express-rate-limit` to mitigate abuse
  - `compression` for optimized API responses

- **Trust Proxy Configuration**
  Enables correct IP detection when deployed behind reverse proxies (e.g., Nginx, Docker, cloud platforms).

- **Traffic Segmentation**
  - **Hot Path (Redirect Engine)**: Minimal middleware for high-speed URL redirection.
  - **API Layer**: Heavy middleware (rate limiting, body parsing, compression) isolated under `/api`.

- **Rate Limiting**
  - Redirect limiter for high-volume public traffic
  - API limiter for authenticated and management endpoints

- **Routing**
  Modular route handling under `/api/v1/users`.

- **Global Error Handling**
  - Centralized error forwarding via `AppError`
  - Final global error handler middleware

- **404 Handling**
  Captures undefined routes and forwards structured errors.

---

### Design Goals

- Clear separation between performance-critical routes and management APIs
- Middleware isolation for optimized request flow
- Production-grade security defaults
- Centralized error control
- Modular, scalable routing structure

## Authentication & Authorization Architecture

The authentication system is designed with security, transaction safety, and replay protection in mind.  
It uses JWT-based authentication with secure password hashing and reset-token workflows.

---

### 🔐 Password Security

- Passwords are hashed using **Argon2** before storage.
- Plaintext passwords are never stored.
- Password updates automatically invalidate existing JWTs using `passwordChangedAt`.

---

### 🎟 JWT Authentication

- Tokens are signed with a server secret and expiration time.
- Protected routes validate:
  - Token presence
  - Token signature
  - User existence
  - Password change after token issuance

This prevents session reuse after password resets.

---

### 🔁 Forgot Password Flow

1. User submits email.
2. System responds with a generic success message (prevents user enumeration).
3. If user exists:
   - All existing unused reset tokens are invalidated.
   - A new reset token is generated.
   - Token is hashed and stored with expiration.
   - Email is sent with reset link.

Reset tokens:
- Are stored hashed (never plaintext).
- Have expiration timestamps.
- Are single-use (`usedAt` enforced).
- Are managed inside database transactions.

---

### 🔄 Reset Password Flow

1. Token is hashed and validated against:
   - Matching hash
   - Not expired
   - Not previously used
2. Inside a transaction:
   - User password is updated.
   - `passwordChangedAt` is updated.
   - Reset token is marked as used.
   - Password change history is logged.
3. A new JWT is issued.

This guarantees:
- No replay attacks
- Atomic password updates
- Proper audit logging

---

### 🛡 Role-Based Access Control (RBAC)

- `protect` middleware verifies authentication.
- `restrictTo` middleware enforces role-based permissions.
- Roles are checked per-route.

---

### 📜 Audit Logging

Each password change:
- Is recorded in `passwordChangeHistoryTable`
- Logs IP address and user-agent
- Supports forensic and security analysis

---

### ⚙️ Transaction Safety

All critical operations (password update, token invalidation, history logging) run inside database transactions to ensure:

- Consistency
- No partial state
- No race conditions

---

### 🔒 Security Considerations Implemented

- Argon2 password hashing
- JWT invalidation on password change
- Reset token hashing
- Reset token expiry enforcement
- Replay attack prevention
- User enumeration prevention
- Transaction-based consistency
- Rate limiting (configured at app level)

---

## Summary

The authentication system is:

- Stateless (JWT-based)
- Transaction-safe
- Replay-resistant
- Audit-aware
- Designed for production deployment

It separates active authentication state, historical logs, and user identity data to maintain clean architecture boundaries.
