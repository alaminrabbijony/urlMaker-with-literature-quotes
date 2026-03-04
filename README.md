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

## Database Modeling & Validation

The system separates persistence and validation to maintain clear architecture boundaries.  
Database schemas are defined with **Drizzle ORM**, while incoming requests are validated using **Zod** before reaching business logic.

---

### 🗄 Database Tables

Core tables:

```
users
password_change_history
reset_passwords
```

---

### 👤 Users

Stores identity and authentication data.

```
{
  id,
  name,
  email (unique),
  password,
  role,
  passwordChangedAt,
  createdAt,
  updatedAt
}
```

Roles are implemented using a PostgreSQL enum:

```
["super_admin", "admin", "user"]
```

`passwordChangedAt` is used to invalidate JWTs issued before a password update.

---

### 📜 Password Change History

Tracks password updates for auditing.

```
{
  id,
  userId,
  changedAt,
  ipAddress,
  userAgent
}
```

Foreign key:

```
userId -> users.id
```

---

### 🔁 Reset Password Tokens

Manages password reset workflow.

```
{
  id,
  userId,
  tokenHash,
  expiresAt,
  usedAt,
  createdAt
}
```

Tokens expire and are single-use.

Foreign key:

```
userId -> users.id
```

---

### 🧪 Request Validation (Zod)

Incoming requests are validated before controller logic executes.

Schemas:

```
userSchema
loginUserSchema
forgetPasswordUserSchema
resetPasswordSchema
cusUrlSchema
```

---

### 🔗 URL Creation Validation

```
{
  code (optional),
  targetUrl,
  activeTime
}
```

Constraints:

- `code` minimum length
- `activeTime` positive integer
- max lifetime: **365 days**
- default lifetime: **7 days**

---

## Summary

The persistence layer enforces structural integrity while Zod validation ensures only well-formed data reaches the application logic.

## URL Shortening & Expiring Link Architecture

The URL shortening system allows authenticated users to generate short links that redirect to a target URL.  
Each short URL has a unique code, an optional expiration window, and tracks usage metrics.

The system ensures:

- Collision-safe short code generation
- Automatic expiration handling
- Redirect tracking
- Safe database updates

---

### 🔗 Short URL Creation

Users create short URLs through the `postUrl` endpoint.

Flow:

1. Request payload is validated using **Zod**.
2. A short code is determined:
   - If the user provides `code`, it is used.
   - Otherwise a **6 character NanoID** is generated.
3. The database checks whether the short code already exists.
4. If the code already exists:
   - The request is rejected
   - A suggested alternative code is returned.
5. An expiration timestamp is calculated using the provided `activeTime`.
6. The short URL is stored in the database.

Example stored record:

```
{
  id,
  userId,
  code,
  targetUrl,
  expiresAt,
  clickCount
}
```

Each entry represents a unique redirect resource.

---

### ⏳ Expiration Mechanism

Each short URL includes an expiration timestamp calculated from the requested active time window.

```
expiresAt = Date.now() + activeTime(days)
```

When a redirect request occurs:

- If the current time exceeds `expiresAt`
- The system rejects the request.

Response:

```
410 Gone
```

This prevents expired links from continuing to redirect.

---

### 🚦 Redirect Flow

Redirect requests follow the `getUrl` endpoint.

```
GET /:shortCode
```

Flow:

1. System retrieves the URL record using the provided short code.
2. If the code does not exist → `404 Not Found`.
3. If the URL is expired → `410 Gone`.
4. If valid → redirect to the stored `targetUrl`.

Redirect is handled using:

```
res.redirect(targetUrl)
```

---

### 📊 Click Tracking

Every successful redirect increments the link's usage counter.

Database update:

```
clickCount = clickCount + 1
```

This is executed atomically using a SQL expression:

```
sql`${urlTable.clickCount} + 1`
```

This prevents race conditions when multiple users access the same link simultaneously.

---

### 🔒 Ownership Model

Each short URL is associated with the authenticated user who created it.

```
userId -> usersTable.id
```

This allows:

- Per-user link management
- Future analytics per user
- Role-based URL management if needed

---

### ⚙️ Collision Prevention

Short codes must be globally unique.

When a requested or generated code already exists:

- The system rejects the request
- Suggests a modified code using an additional NanoID suffix

Example suggestion:

```
customCodeAB12
```

This prevents silent overwrites of existing links.

---

### 🛡 Security Considerations Implemented

- Input validation using Zod
- Collision detection for short codes
- Expiration enforcement
- Atomic click count updates
- Authentication required for link creation

---

## Summary

The URL shortening system is designed to be:

- Collision-safe
- Expiration-aware
- Redirect-efficient
- Analytics-ready
- Scalable for high traffic usage

Each short link acts as an independent redirect resource with built-in expiration and usage tracking.
