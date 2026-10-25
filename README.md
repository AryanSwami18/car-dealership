# Car Dealership Inventory System

This repository is a TypeScript full-stack monorepo for the Car Dealership Inventory System.
The application is being developed incrementally using test-driven development.

## Repository structure

- `apps/api` — Express and Prisma backend workspace
- `apps/web` — React, Vite, and Tailwind CSS frontend workspace
- `.env.example` — local development environment variable template

## Prerequisites

- Node.js 26 or a compatible current LTS release
- npm 11 or compatible npm version
- PostgreSQL 18 or a compatible supported version

PostgreSQL should be running locally and accepting connections on port `5432`.

## Initial setup

```bash
cp .env.example .env
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Create the local development role and database once, using the native PostgreSQL
installation. The password prompt keeps the password out of the shell history:

```bash
sudo -u postgres createuser --login --pwprompt inventory_app
sudo -u postgres createdb --owner=inventory_app inventory_dev
pg_isready -h localhost -p 5432
```

Update the local `DATABASE_URL` in `.env` with the password chosen for `inventory_app`.
PostgreSQL remains a local service and is not exposed by this project configuration. No
application database models or migrations have been added yet; those will be introduced with
the relevant feature tests.

## Development commands

```bash
npm run dev --workspace @car-dealership/api
npm run dev --workspace @car-dealership/web
```

## Frontend authentication storage

The frontend stores the short-lived JWT returned by the existing login endpoint in
`localStorage` under `accessToken`, and stores only the returned public user metadata under
`authUser`. This keeps authentication state available across route changes and browser reloads,
and matches the current API client's bearer-token setup.

`localStorage` is not inherently secure: an XSS vulnerability could read the token. The current
backend returns the JWT in JSON and does not implement an HTTP-only cookie flow, so introducing a
cookie-based strategy here would be incomplete. The frontend never stores passwords, treats the
stored role as presentation state only, and relies on backend authentication and authorization for
actual access control. A future production hardening step could move the token to a `Secure`,
`HttpOnly`, `SameSite` cookie flow with the corresponding CSRF protection.

## My AI Usage

Codex assisted with the initial repository inspection, monorepo scaffolding, development-tool
configuration, and testing-infrastructure smoke tests. I will review the generated configuration,
run the commands locally, and adapt future implementation decisions myself. This setup does not
claim any application feature or deployment work.

The root `PROMPTS.md` is reserved for raw, unedited AI chat logs or public chat links. Summaries
must not be used as a substitute for those records.

## Current status

The repository contains the Maison Motoring landing page, authenticated vehicle inventory and
vehicle-detail views, and frontend registration/login flows. Backend vehicle and authentication
features are covered by the existing API implementation and tests. Purchasing and admin dashboard
UI remain intentionally outside the current frontend scope.
