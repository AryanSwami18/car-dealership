# Car Dealership Inventory System

This repository is a TypeScript full-stack monorepo for a dealership inventory application. It is developed incrementally with test-driven development. Hosting, AWS, and cloud deployment are intentionally out of scope for this local-development phase.

## Architecture

- `apps/api` — Express, TypeScript, Prisma, and PostgreSQL backend.
- `apps/web` — React, Vite, TypeScript, and Tailwind CSS frontend.
- PostgreSQL — native local service for development and a separate `inventory_test` database for API integration tests.
- Prisma — schema, generated client, and checked-in migrations.

The frontend calls the API with `VITE_API_BASE_URL` and sends the bearer token returned by login. The backend is the security boundary: frontend role checks only improve navigation and user experience.

## Prerequisites

Install or verify:

- Node.js 26 and npm 11, or compatible supported versions.
- PostgreSQL 18, or a compatible supported version, running locally on port `5432`.
- Git.

The API and frontend dependencies are installed from the repository root. Docker is not required for the current native-PostgreSQL setup.

## Install and environment setup

```bash
cp .env.example .env
npm install
```

Edit `.env` with local values. `.env.example` contains placeholders only and must not be used as a source of real credentials. Generate a local JWT secret without placing it in shell history or documentation:

```bash
openssl rand -base64 32
```

Required runtime variables are:

- `NODE_ENV` — `development`, `test`, or `production`.
- `API_PORT` — API port, normally `3000` for development.
- `DATABASE_URL` — PostgreSQL URL for the development database.
- `JWT_SECRET` — at least 32 random characters; never log or commit it.
- `CORS_ORIGINS` — comma-separated, explicit browser origins. Wildcards are rejected.
- `BODY_SIZE_LIMIT` — Express JSON limit such as `100kb`.
- `VITE_API_BASE_URL` — frontend API base URL, normally `http://localhost:3000/api`.

The API validates configuration at startup and reports only non-sensitive configuration errors. `.env`, `apps/api/.env.test`, and other environment files are ignored by Git.

## Native PostgreSQL setup

Run these commands in an Omarchy terminal. The first command creates the application login role and prompts for its password. The second and third create databases owned by that role. Run creation commands only when the role or database does not already exist.

```bash
sudo systemctl enable --now postgresql
pg_isready -h localhost -p 5432
sudo -u postgres createuser --login --pwprompt inventory_app
sudo -u postgres createdb --owner=inventory_app inventory_dev
sudo -u postgres createdb --owner=inventory_app inventory_test
```

If a role or database already exists, keep it and continue; do not drop or reset it. The development URL in `.env` must point to `inventory_dev`. The test URL in `apps/api/.env.test` must point to `inventory_test`. Verify database names without printing passwords:

```bash
sudo -u postgres psql -Atc "SELECT datname FROM pg_database WHERE datname IN ('inventory_dev','inventory_test') ORDER BY datname;"
```

Create the ignored test environment file from the placeholder template when needed:

```bash
cp apps/api/.env.test.example apps/api/.env.test
${EDITOR:-vi} apps/api/.env.test
```

Set a test-only `DATABASE_URL` for `inventory_test` and a test-only JWT secret. Never point test cleanup or migrations at `inventory_dev`.

## Prisma migrations

Apply the checked-in migration to the development database:

```bash
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npx prisma generate --schema apps/api/prisma/schema.prisma
```

For the dedicated test database, load only `apps/api/.env.test` and apply the same checked-in migrations:

```bash
set -a
source apps/api/.env.test
set +a
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

`migrate deploy` applies pending checked-in migrations; it is not a substitute for reviewing a new migration. Do not run `prisma migrate reset` against a development database. The schema includes foreign keys that restrict deletion of users or vehicles referenced by purchases, plus database checks for non-negative vehicle prices, non-negative stock, non-negative purchase snapshot prices, and positive purchase quantities.

## Development commands

Run each process in its own terminal:

```bash
npm run dev --workspace @car-dealership/api
npm run dev --workspace @car-dealership/web
```

The API listens on `http://localhost:3000` and the Vite frontend normally listens on `http://localhost:5173`.

## Verification commands

From the repository root:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
git diff --check
npx prisma validate --schema apps/api/prisma/schema.prisma
npx prisma migrate status --schema apps/api/prisma/schema.prisma
```

The API integration tests load `apps/api/.env.test` and require PostgreSQL plus the `inventory_test` database. Run them separately while diagnosing failures:

```bash
npm test --workspace @car-dealership/api
npm test --workspace @car-dealership/web
```

If a restricted execution environment reports `listen EPERM`, run the API tests in a normal Omarchy terminal. The test process must be able to bind its local Supertest/Express server and must be connected to `inventory_test` only.

## API contracts

All error responses use the safe shape `{ "error": { "code": "...", "message": "..." } }`. Internal stack traces, database URLs, passwords, JWTs, and database details are not returned.

### Health and authentication

- `GET /health` — `200 { "status": "ok" }`; lightweight and does not expose database details.
- `POST /api/auth/register` — body `{ name, email, password }`; returns `201 { user }`. Public registration always creates `USER`, even if a client submits a role. Email is normalized and unique. Validation returns `400`; duplicate email returns `409`.
- `POST /api/auth/login` — body `{ email, password }`; returns `200 { token, user }`. Invalid credentials return a generic `401` response. The token is an HS256 JWT with a one-hour expiration and contains the authenticated user identifier and role, not a password.

The public user representation contains `id`, `name`, `email`, `role`, and `createdAt`; it never contains `passwordHash`.

### Vehicles

Vehicle responses use `{ id, make, model, category, price, quantityInStock, createdAt, updatedAt }`. Prices are serialized as two-decimal strings.

- `GET /api/vehicles?search=&category=` — authenticated `USER` or `ADMIN`; returns `200 { vehicles: [...] }`. `search` matches make or model case-insensitively, and `category` filters category. Results have deterministic ordering.
- `POST /api/vehicles` — `ADMIN` only; body `{ make, model, category, price, quantityInStock }`; returns `201 { vehicle }`.
- `PUT /api/vehicles/:id` — `ADMIN` only; full replacement using the same vehicle body; returns `200 { vehicle }`.
- `DELETE /api/vehicles/:id` — `ADMIN` only; returns `204` when deletion succeeds. Vehicles with purchase history cannot be deleted and return a safe conflict response.
- `POST /api/vehicles/:id/restock` — `ADMIN` only; body `{ quantity }` where quantity is a positive integer; returns `200 { vehicle }`.
- `POST /api/vehicles/:id/purchase` — authenticated `USER` or `ADMIN`; body `{ quantity }` where quantity is a positive integer; returns `201 { purchase }`. Insufficient stock returns `409` and cannot oversell under concurrent transactions. The purchase stores a unit-price snapshot.

Malformed UUIDs, invalid numeric values, negative prices or stock, fractional quantities, empty required strings, and out-of-range values return safe `4xx` responses.

### Purchase history

- `GET /api/purchases` — authenticated users only; returns `200 { purchases: [...] }`.
- A `USER` receives only their own records. An `ADMIN` receives all purchase records under the current backend policy.
- Each item contains `id`, `userId`, `vehicleId`, `quantity`, purchase-time `unitPrice`, `purchasedAt`, and safe public `vehicle` details. Results are newest first with a stable ID tie-breaker.

Every protected route requires `Authorization: Bearer <token>`. Authentication and authorization are enforced by the backend, including direct API calls that bypass the frontend.

## Main workflows

Customer workflow: register, log in, browse authenticated inventory, search or filter, open vehicle details, select a positive quantity within stock, confirm purchase, view purchase history, and log out. Protected pages require login again after logout or session expiry.

Admin workflow: log in as an existing `ADMIN`, open the admin inventory screen, create or edit vehicles, restock positive quantities, delete vehicles without purchase history, and review the resulting inventory. The API independently enforces the `ADMIN` boundary; a client-side role check is not sufficient authorization.

## Security and local limitations

- Passwords are hashed with bcrypt and are never returned.
- JWT verification uses the configured secret, accepted algorithm, and expiry. Secrets are read from ignored environment files.
- CORS uses an explicit configured origin allowlist. Production must not use arbitrary origins.
- Request bodies have a configured size limit, and request/error logs omit credentials, bodies, authorization headers, and stack traces.
- The frontend currently stores the short-lived bearer token in `localStorage` because the backend returns JSON and does not implement an HTTP-only cookie flow. This is vulnerable to token theft if an XSS flaw exists. A future cookie migration would require coordinated backend and CSRF work.
- There is no payment processing, cancellation/refund workflow, or managed deployment in this local phase.
- Browser-level E2E tests are not configured in the repository and were not run in the restricted Codex environment. Component tests and API tests must not be described as browser E2E tests.
- Native PostgreSQL must be running for Prisma migration status and API integration tests. If the API suite reports `localhost:5432` unavailable, start PostgreSQL and verify the test database before retrying.

## Troubleshooting

Check PostgreSQL without exposing credentials:

```bash
pg_isready -h localhost -p 5432
sudo systemctl status postgresql --no-pager
```

Check the test database and migrate it from a normal user terminal:

```bash
set -a
source apps/api/.env.test
set +a
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm test --workspace @car-dealership/api
```

If the shell reports `listen EPERM` during API tests, that is an execution-environment restriction rather than an application assertion. Run the same command in the user's Omarchy terminal. If migrations or tests mention `inventory_dev` while using the test file, stop and correct `DATABASE_URL` before continuing.

## AI usage record

The repository's `PROMPTS.md` records the exact completion brief that was available to this validation pass and documents which earlier transcript sources were unavailable. It must be extended with original exported prompts and responses when those are supplied; fabricated summaries are not acceptable.
