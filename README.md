# Leeford Healthcare Admin Portal

Secure internal administration portal built with an Express/TypeScript API, PostgreSQL (`pg`), and a Next.js/React frontend.

## Requirements

- Node.js 22 or newer
- PostgreSQL 14 or newer
- SMTP account for password-reset email delivery

## Configuration

Copy `.env.example` to `.env` and supply the deployment-specific values. `SESSION_SECRET` must be a randomly generated value of at least 32 characters. Use either `DATABASE_URL` or the individual `DB_*` settings.

Admin usernames and passwords must never be added to `.env`. The initial account is created interactively after migrations run.

For a production frontend deployment, set `API_INTERNAL_URL` in the frontend process to the internal API origin if it is not `http://localhost:5000`.

## Setup

```bash
npm install
npm --prefix web install
npm run migrate
npm run create-admin
npm run dev
```

The API listens on `PORT` (default `5000`) and the web application on port `3000` during development.

## Production

```bash
npm run build
npm run migrate:prod
npm start
npm run start:web
```

Run the API and frontend as separate supervised processes. The frontend proxies `/api/*` to `API_INTERNAL_URL`.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Authentication design

- Passwords use Argon2id and only `password_hash` is stored.
- Sessions use random opaque cookies; only HMAC-SHA256 token hashes are stored in PostgreSQL.
- Authentication cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- State-changing requests require a matching CSRF cookie/header pair and an allowed origin.
- Five incorrect account attempts trigger a 15-minute temporary lock.
- Login and password-reset endpoints also have IP-based rate limiting.
- Reset tokens are cryptographically random, HMAC-hashed in storage, expire after 45 minutes, and are single-use.
- A password reset revokes all existing sessions and outstanding reset tokens for that account.
- Authentication events are recorded in `audit_logs` without passwords or tokens.

## Routes

Public pages: `/login`, `/forgot-password`, `/reset-password?token=...`

Protected page: `/admin/dashboard`

Authentication API: `/api/auth/csrf-token`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/reset-password`
