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
- Docker, for local Postgres and LocalStack

## Setup

```bash
nvm use               # match the Node version this repo is tested against
pnpm install           # install all workspace packages
pnpm docker:up         # start Postgres + LocalStack (see docker-compose.yml)
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
| `pnpm docker:up`    | Starts local infra (Postgres + LocalStack) in the background |
| `pnpm docker:down`  | Stops local infra                                   |
| `pnpm docker:logs`  | Tails the Postgres container logs                   |
| `pnpm docker:reset` | Stops local infra and wipes its data volume          |

Each app/service/package that implements a script (build/test/typecheck/dev) defines it in its own `package.json`; `pnpm -r` skips workspace members that don't define it.

## Local messaging (LocalStack)

LocalStack emulates SQS/SNS on `http://localhost:4566`. Resources are created automatically on `pnpm docker:up` by [docker/localstack/init/01-create-resources.sh](docker/localstack/init/01-create-resources.sh):

| Resource | Name | Purpose |
| --- | --- | --- |
| SNS Topic | `local-orders-order-placed-topic` | Published to by Order API when a purchase completes |
| SQS Queue | `local-inventory-order-placed-queue` | Consumed by Inventory Service to deduct stock |
| SQS Queue (DLQ) | `local-inventory-order-placed-dlq` | Failed inventory processing jobs (after 3 receives) |
| SQS Queue | `local-email-order-placed-queue` | Consumed by Notification Service to send buyer receipt |
| SQS Queue (DLQ) | `local-email-order-placed-dlq` | Failed email sends (after 3 receives) |

The topic fans out to both queues with raw message delivery enabled (consumers get the plain event JSON, not an SNS-wrapped envelope).

To connect from a service, point the AWS SDK at LocalStack with dummy credentials:

```ts
new SQSClient({
  endpoint: "http://localhost:4566",
  region: "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});
```

To inspect resources manually: `docker exec e-commerce-localstack awslocal sqs list-queues --region us-east-1` (swap `sqs` for `sns` as needed).

## Contributing

- Use the pull request template in [.github/pull_request_template.md](.github/pull_request_template.md) when opening a PR.
- Record architectural decisions in [adr/README.md](adr/README.md) and add new ADRs under [adr](adr).
