# Car Dealership Inventory System

This repository is a TypeScript full-stack monorepo for the Car Dealership Inventory System.
The application is being developed incrementally using test-driven development.

## Repository structure

- `apps/api` — Express and Prisma backend workspace
- `apps/web` — React, Vite, and Tailwind CSS frontend workspace
- `docker-compose.yml` — local PostgreSQL service definition

## Prerequisites

- Node.js 26 or a compatible current LTS release
- npm 11 or compatible npm version
- Docker and Docker Compose for local PostgreSQL

Docker must be usable by the current user without running every command with `sudo`.

## Initial setup

```bash
cp .env.example .env
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

The local database service can be started after Docker access is available:

```bash
docker compose up -d postgres
docker compose ps
```

PostgreSQL is bound to `127.0.0.1` only. No application database models or migrations have
been added yet; those will be introduced with the relevant feature tests.

## Development commands

```bash
npm run dev --workspace @car-dealership/api
npm run dev --workspace @car-dealership/web
```

## My AI Usage

Codex assisted with the initial repository inspection, monorepo scaffolding, development-tool
configuration, and testing-infrastructure smoke tests. I will review the generated configuration,
run the commands locally, and adapt future implementation decisions myself. This setup does not
claim any application feature or deployment work.

The root `PROMPTS.md` is reserved for raw, unedited AI chat logs or public chat links. Summaries
must not be used as a substitute for those records.

## Current status

The repository currently contains only project setup and smoke tests. Authentication, vehicle
management, inventory logic, database models, and application pages are intentionally not
implemented yet.
