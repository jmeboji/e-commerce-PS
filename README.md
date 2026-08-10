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
  products/       product catalog — implemented
  cart/           shopping cart, calls products over HTTP — implemented
  orders/         checkout: calls cart over HTTP, publishes OrderCreated via SNS — implemented
  inventory/      (scaffolded, not yet implemented)
  notifications/  (scaffolded, not yet implemented)

packages/         shared code
  ui/             shared UI components
  shared-types/   shared TypeScript types
  eslint-config/  shared lint config

docker/           local infra (Postgres init scripts)
terraform/        LocalStack SQS/SNS topology (see "Local messaging" below)
docs/             architecture notes
```

## Requirements

- Node `>=20.12.0` (repo is pinned to `22.23.1` via `.nvmrc` — run `nvm use`)
- pnpm `10.12.1` (see `packageManager` in [package.json](package.json))
- Docker, for local Postgres and LocalStack
- Terraform `>= 1.5`, for provisioning the local SQS/SNS topology (`brew install hashicorp/tap/terraform` — plain `brew install terraform` no longer works since HashiCorp pulled it from `homebrew-core`)

## Setup

```bash
nvm use               # match the Node version this repo is tested against
pnpm install           # install all workspace packages
pnpm docker:up         # start Postgres + LocalStack (see docker-compose.yml)
pnpm infra:apply       # provision the SQS/SNS topology into the now-running LocalStack
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
| `pnpm test`         | Runs `test:unit` in every service, in parallel — see [Running tests](#running-tests) |
| `pnpm test:integration` | Runs `test:integration` in every service, sequentially — see [Running tests](#running-tests) |
| `pnpm test:all`     | Runs `pnpm test` then `pnpm test:integration` |
| `pnpm typecheck`    | Runs `typecheck` in every workspace package that has one |
| `pnpm docker:up`    | Starts local infra (Postgres + LocalStack) in the background |
| `pnpm docker:down`  | Stops local infra                                   |
| `pnpm docker:logs`  | Tails the Postgres container logs                   |
| `pnpm docker:reset` | Stops local infra and wipes its data volume          |
| `pnpm infra:apply`  | Provisions the SQS/SNS topology into LocalStack (`terraform apply`) |
| `pnpm infra:destroy`| Tears down the SQS/SNS topology (`terraform destroy`) |

Each app/service/package that implements a script (build/test/typecheck/dev) defines it in its own `package.json`; `pnpm -r` skips workspace members that don't define it.

## Running tests

- `pnpm test` (root) — runs every service's **unit tests** in parallel. Fast, safe to run anytime.
- `pnpm test:integration` (root) — runs every service's **integration tests sequentially**, not in parallel. Several integration tests (`orders`, `inventory`) interact with the same real LocalStack SQS queue; running them concurrently can cause one test to consume or purge a message another test is asserting on, producing an intermittent false failure that is not a real product bug (see ECOM-14c).
- `pnpm test:all` (root) — runs both, in the correct order.
- Within a single service (e.g. `cd services/orders && pnpm test`), unit and integration tests always run together safely — the collision only happens *across* services sharing infra, run in parallel.

## Local messaging (LocalStack)

LocalStack emulates SQS/SNS on `http://localhost:4566`. Resources are provisioned declaratively via Terraform ([terraform/](terraform/)) — run `pnpm infra:apply` after `pnpm docker:up` (LocalStack has to already be running; Terraform is just an AWS API client pointed at it):

| Resource | Name | Purpose |
| --- | --- | --- |
| SNS Topic | `local-orders-order-placed-topic` | Published to by `orders` when a checkout completes |
| SQS Queue | `local-inventory-order-placed-queue` | For Inventory Service to deduct stock (service not yet implemented) |
| SQS Queue (DLQ) | `local-inventory-order-placed-dlq` | Failed inventory processing jobs (after 3 receives) |
| SQS Queue | `local-email-order-placed-queue` | For Notification Service to send a buyer receipt (service not yet implemented) |
| SQS Queue (DLQ) | `local-email-order-placed-dlq` | Failed email sends (after 3 receives) |

The topic fans out to both queues with raw message delivery enabled (consumers get the plain event JSON, not an SNS-wrapped envelope). `orders` is currently the only real publisher; nothing in this repo consumes yet, so messages just sit in the queues until `inventory`/`notifications` are built.

**`OrderCreated` payload** (published by `services/orders/src/clients/sns.client.ts`):

```json
{
  "orderId": "uuid",
  "userId": "uuid",
  "total": "25.25",
  "items": [{ "productId": "uuid", "quantity": 2, "price": "10.00" }]
}
```

To connect from a service, point the AWS SDK at LocalStack with dummy credentials — same pattern for both clients:

```ts
new SNSClient({
  endpoint: "http://localhost:4566",
  region: "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});
```

To inspect resources manually: `docker exec e-commerce-localstack awslocal sqs list-queues --region us-east-1` (swap `sqs` for `sns` as needed).

## Contributing

- Use the pull request template in [.github/pull_request_template.md](.github/pull_request_template.md) when opening a PR.
- Record architectural decisions in [adr/README.md](adr/README.md) and add new ADRs under [adr](adr).
