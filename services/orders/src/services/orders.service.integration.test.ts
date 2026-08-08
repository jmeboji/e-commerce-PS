import "dotenv/config";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseDotenv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SQSClient, ReceiveMessageCommand, PurgeQueueCommand } from "@aws-sdk/client-sqs";
import type { prisma as OrdersPrismaClient } from "../db/prisma.js";
import type { createOrder as CreateOrder } from "./orders.service.js";

// Set before any dynamic import of the orders service chain below, since
// config/env.ts (via cart.client.ts) reads this once at module-evaluation time.
const TEST_PORT = 4098;
const CART_SERVICE_URL = `http://localhost:${TEST_PORT}`;
process.env.CART_SERVICE_URL = CART_SERVICE_URL;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cartDir = path.resolve(__dirname, "../../../cart");
const cartPrismaPath = path.resolve(cartDir, "src/db/prisma.ts");

const INVENTORY_QUEUE_URL =
  "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/local-inventory-order-placed-queue";

const sqsClient = new SQSClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

async function waitForHealth(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // not up yet, keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`cart service did not become healthy within ${timeoutMs}ms`);
}

describe("createOrder (integration, real cart service + real LocalStack SNS/SQS)", () => {
  let cartProcess: ChildProcess;
  let prisma: typeof OrdersPrismaClient;
  let createOrder: typeof CreateOrder;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cartPrisma: any;
  let cartId: string;
  let orderId: string | undefined;
  let userId: string;
  let productId: string;

  beforeAll(async () => {
    // Don't let orders' own DATABASE_URL (loaded via dotenv/config above) leak
    // into the spawned cart process — it needs to load its own .env
    // (cart_db), and dotenv never overrides an already-set variable.
    const childEnv = { ...process.env, PORT: String(TEST_PORT) };
    delete childEnv.DATABASE_URL;

    cartProcess = spawn("pnpm", ["exec", "tsx", "src/index.ts"], {
      cwd: cartDir,
      env: childEnv,
      stdio: "pipe",
    });

    await waitForHealth(CART_SERVICE_URL);

    // Clear the queue so this test can unambiguously identify its own message.
    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: INVENTORY_QUEUE_URL })).catch(() => {});

    // Dynamic imports: must happen after CART_SERVICE_URL is set above.
    ({ prisma } = await import("../db/prisma.js"));
    ({ createOrder } = await import("./orders.service.js"));

    // Seed the cart directly against cart's own database — this is test
    // setup, not the thing this test verifies, so it deliberately bypasses
    // cart's HTTP layer (which would otherwise also require products running).
    //
    // orders' own `prisma` above already captured its DATABASE_URL at
    // construction time, so it's safe to swap process.env.DATABASE_URL to
    // cart's value here before cart's PrismaClient is constructed — Prisma
    // reads it fresh at each `new PrismaClient()` call, not per-query.
    const cartEnv = parseDotenv(readFileSync(path.resolve(cartDir, ".env"), "utf-8"));
    process.env.DATABASE_URL = cartEnv.DATABASE_URL;
    ({ prisma: cartPrisma } = await import(cartPrismaPath));

    userId = randomUUID();
    productId = randomUUID();
    const cart = await cartPrisma.cart.create({ data: { userId } });
    cartId = cart.id;
    await cartPrisma.cartItem.create({
      data: { cartId, productId, quantity: 2, price: "15.00" },
    });
  }, 30000);

  afterAll(async () => {
    if (orderId) {
      await prisma?.order.delete({ where: { id: orderId } }).catch(() => {});
    }
    if (cartId) {
      await cartPrisma?.cart.delete({ where: { id: cartId } }).catch(() => {});
    }
    await prisma?.$disconnect();
    await cartPrisma?.$disconnect();
    cartProcess?.kill();
  });

  it("checks out a real cart, persists the order, and actually delivers OrderCreated to a subscribed queue", async () => {
    const order = await createOrder({ userId, cartId });
    orderId = order.id;

    expect(order.total.toString()).toBe("30");
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ productId, quantity: 2 });

    // Prove actual delivery, not just that publish() didn't throw.
    const received = await sqsClient.send(
      new ReceiveMessageCommand({ QueueUrl: INVENTORY_QUEUE_URL, WaitTimeSeconds: 5 }),
    );
    const message = received.Messages?.[0];
    expect(message).toBeDefined();

    const body = JSON.parse(message!.Body!);
    expect(body.orderId).toBe(order.id);
    expect(body.userId).toBe(userId);
    expect(body.total).toBe("30");
    expect(body.items).toEqual([{ productId, quantity: 2, price: "15" }]);

    // ECOM-13b: checkout must actually clear the source cart, not just
    // publish the event — confirm against cart's own database, not orders'.
    const remainingItems = await cartPrisma.cartItem.count({ where: { cartId } });
    expect(remainingItems).toBe(0);

    // A repeat checkout against the now-empty cart must hit the "cart is
    // empty" 400, not silently produce a second order for the same items.
    await expect(createOrder({ userId, cartId })).rejects.toMatchObject({ status: 400 });
  }, 15000);
});
