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
  inventory/      consumes OrderCreated over SQS, decrements stock — implemented
  notifications/  consumes OrderCreated over SQS, records order receipts — implemented
  recommendations/ semantic product search (Python/FastAPI + pgvector), consumes ProductChanged over SQS — implemented

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
- Python `>=3.11`, for `recommendations` only — every other service is Node. **On Intel Macs specifically, use Python 3.12, not 3.13**: `torch` (a `sentence-transformers` dependency) has no macOS x86_64 wheel past version 2.2.2, which doesn't support 3.13. `brew install python@3.12` if you don't already have it. See `services/recommendations/pyproject.toml` for the exact dependency versions this pins to work around it (also affects `numpy`/`scipy`/`transformers`, all pinned narrowly to that platform).

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

`recommendations` is Python, not Node, so its setup is different — no `pnpm`, no Prisma migrations (tables are created via SQLAlchemy `create_all()` at startup, by either `main.py` or `worker.py`, whichever runs first):

```bash
cd services/recommendations
python3.12 -m venv .venv        # 3.12, not 3.13 — see Requirements above
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn src.main:app --reload --port 4007   # the search HTTP API
python -m src.worker                        # separately: the ProductChanged consumer
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
| SQS Queue | `local-inventory-order-placed-queue` | Consumed by `inventory` to deduct stock |
| SQS Queue (DLQ) | `local-inventory-order-placed-dlq` | Failed inventory processing jobs (after 3 receives) |
| SQS Queue | `local-email-order-placed-queue` | Consumed by `notifications` to record order receipts |
| SQS Queue (DLQ) | `local-email-order-placed-dlq` | Failed notification processing jobs (after 3 receives) |
| SNS Topic | `local-products-product-changed-topic` | Published to by `products` on create/update/delete |
| SQS Queue | `local-recommendations-product-changed-queue` | Consumed by `recommendations` to keep embeddings in sync |
| SQS Queue (DLQ) | `local-recommendations-product-changed-dlq` | Failed embedding upserts/deletes (after 3 receives) |

`local-orders-order-placed-topic` fans out to both the inventory and email queues with raw message delivery enabled (consumers get the plain event JSON, not an SNS-wrapped envelope). `orders` publishes; `inventory` and `notifications` each run a worker (`pnpm worker:dev`) that long-polls its own queue.

`local-products-product-changed-topic` fans out to a single queue the same way. `products` publishes on every create/update/delete; `recommendations` runs a Python consumer (`python -m src.worker` — this service isn't Node, so no `pnpm worker:dev`) that keeps `product_embeddings` in sync in real time. `scripts/ingest_products.py` is a separate backfill/recovery tool for seeding or repairing the embedding index, not part of this real-time flow — see its own docstring.

**`OrderCreated` payload** (published by `services/orders/src/clients/sns.client.ts`):

```json
{
  "orderId": "uuid",
  "userId": "uuid",
  "total": "25.25",
  "items": [{ "productId": "uuid", "quantity": 2, "price": "10.00" }]
}
```

**`ProductChanged` payload** (published by `services/products/src/clients/sns.client.ts`) — a discriminated union on `eventType`; `name`/`description` only appear on `created`/`updated` (that's what gets embedded), since removing an embedding only needs `productId`:

```json
// created / updated
{
  "eventType": "created",
  "productId": "uuid",
  "name": "string",
  "description": "string"
}

// deleted
{
  "eventType": "deleted",
  "productId": "uuid"
}
```

To connect from a service, point the AWS SDK at LocalStack with dummy credentials — same pattern across all the Node clients:

```ts
new SNSClient({
  endpoint: "http://localhost:4566",
  region: "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});
```

`recommendations` is Python, so it uses `boto3` instead of the AWS SDK for JS:

```python
boto3.client(
    "sqs",
    endpoint_url="http://localhost:4566",
    region_name="us-east-1",
    aws_access_key_id="test",
    aws_secret_access_key="test",
)
```

To inspect resources manually: `docker exec e-commerce-localstack awslocal sqs list-queues --region us-east-1` (swap `sqs` for `sns` as needed).

## Contributing

- Use the pull request template in [.github/pull_request_template.md](.github/pull_request_template.md) when opening a PR.
- Record architectural decisions in [adr/README.md](adr/README.md) and add new ADRs under [adr](adr).
