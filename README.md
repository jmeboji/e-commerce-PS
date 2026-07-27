# E-Commerce Platform

Monorepo for the e-commerce platform, managed with pnpm workspaces.

## Structure

```
apps/            customer-facing and internal frontends
  web/            storefront
  admin/          admin dashboard
  api-gateway/    BFF / routing layer in front of services

services/        backend microservices
  users/          user accounts (Express + TypeScript + Prisma/Postgres) — implemented
  products/       (scaffolded, not yet implemented)
  cart/           (scaffolded, not yet implemented)
  orders/         (scaffolded, not yet implemented)
  inventory/      (scaffolded, not yet implemented)
  notifications/  (scaffolded, not yet implemented)

packages/         shared code
  ui/             shared UI components
  shared-types/   shared TypeScript types
  eslint-config/  shared lint config

docker/           local infra (Postgres init scripts, etc.)
docs/             architecture notes
```

## Requirements

- Node `>=20.12.0` (repo is pinned to `22.23.1` via `.nvmrc` — run `nvm use`)
- pnpm `10.12.1` (see `packageManager` in [package.json](package.json))
- Docker, for local Postgres

## Setup

```bash
nvm use               # match the Node version this repo is tested against
pnpm install           # install all workspace packages
pnpm docker:up         # start Postgres (see docker-compose.yml)
```

Then, per service (example: `users`):

```bash
cd services/users
cp .env.example .env
pnpm prisma:migrate    # create tables
pnpm dev               # start with live reload
```

## Root scripts

| Script             | What it does                                      |
| ------------------ | -------------------------------------------------- |
| `pnpm build`        | Runs `build` in every workspace package that has one |
| `pnpm test`         | Runs `test` in every workspace package that has one  |
| `pnpm typecheck`    | Runs `typecheck` in every workspace package that has one |
| `pnpm docker:up`    | Starts local infra (Postgres) in the background     |
| `pnpm docker:down`  | Stops local infra                                   |
| `pnpm docker:logs`  | Tails the Postgres container logs                   |
| `pnpm docker:reset` | Stops local infra and wipes its data volume          |

Each app/service/package that implements a script (build/test/typecheck/dev) defines it in its own `package.json`; `pnpm -r` skips workspace members that don't define it.
