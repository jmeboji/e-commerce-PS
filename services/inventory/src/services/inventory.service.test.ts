import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.js";
import { processOrderCreated } from "./inventory.service.js";
import type { OrderCreatedEvent } from "../schemas/inventory.schema.js";

function fakeEvent(overrides: Partial<OrderCreatedEvent> = {}): OrderCreatedEvent {
  return {
    orderId: randomUUID(),
    userId: randomUUID(),
    total: "0.00",
    items: [],
    ...overrides,
  };
}

describe("processOrderCreated", () => {
  let productIds: string[];
  let messageIds: string[];

  beforeEach(() => {
    productIds = [];
    messageIds = [];
  });

  afterEach(async () => {
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.processedMessage.deleteMany({ where: { messageId: { in: messageIds } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("decrements stock for a single item", async () => {
    const productId = randomUUID();
    productIds.push(productId);
    await prisma.inventory.create({ data: { productId, stock: 10 } });

    const messageId = randomUUID();
    messageIds.push(messageId);

    await processOrderCreated(
      messageId,
      fakeEvent({ items: [{ productId, quantity: 3, price: "10.00" }] }),
    );

    const inventory = await prisma.inventory.findUnique({ where: { productId } });
    expect(inventory?.stock).toBe(7);
  });

  it("decrements stock for multiple items in one event", async () => {
    const productA = randomUUID();
    const productB = randomUUID();
    productIds.push(productA, productB);
    await prisma.inventory.create({ data: { productId: productA, stock: 10 } });
    await prisma.inventory.create({ data: { productId: productB, stock: 5 } });

    const messageId = randomUUID();
    messageIds.push(messageId);

    await processOrderCreated(
      messageId,
      fakeEvent({
        items: [
          { productId: productA, quantity: 4, price: "1.00" },
          { productId: productB, quantity: 2, price: "1.00" },
        ],
      }),
    );

    const invA = await prisma.inventory.findUnique({ where: { productId: productA } });
    const invB = await prisma.inventory.findUnique({ where: { productId: productB } });
    expect(invA?.stock).toBe(6);
    expect(invB?.stock).toBe(3);
  });

  it("is idempotent: a repeat call with the same messageId is a no-op", async () => {
    const productId = randomUUID();
    productIds.push(productId);
    await prisma.inventory.create({ data: { productId, stock: 10 } });

    const messageId = randomUUID();
    messageIds.push(messageId);
    const event = fakeEvent({ items: [{ productId, quantity: 3, price: "10.00" }] });

    await processOrderCreated(messageId, event);
    await processOrderCreated(messageId, event);

    const inventory = await prisma.inventory.findUnique({ where: { productId } });
    expect(inventory?.stock).toBe(7);

    const processedCount = await prisma.processedMessage.count({ where: { messageId } });
    expect(processedCount).toBe(1);
  });

  it("throws a clear error when the product has no inventory record at all", async () => {
    const productMissing = randomUUID();
    productIds.push(productMissing);
    // productMissing intentionally has no Inventory row.

    const orderId = randomUUID();
    const messageId = randomUUID();
    messageIds.push(messageId);

    await expect(
      processOrderCreated(
        messageId,
        fakeEvent({ orderId, items: [{ productId: productMissing, quantity: 1, price: "1.00" }] }),
      ),
    ).rejects.toThrow(
      `Cannot process order ${orderId}: no inventory record for product(s) ${productMissing}`,
    );

    const processedCount = await prisma.processedMessage.count({ where: { messageId } });
    expect(processedCount).toBe(0);
  });

  it("throws and decrements nothing if any item's product has no inventory row, even when other items in the same event do exist", async () => {
    const productWithStock = randomUUID();
    const productMissing = randomUUID();
    productIds.push(productWithStock, productMissing);
    await prisma.inventory.create({ data: { productId: productWithStock, stock: 10 } });
    // productMissing intentionally has no Inventory row.

    const orderId = randomUUID();
    const messageId = randomUUID();
    messageIds.push(messageId);

    await expect(
      processOrderCreated(
        messageId,
        fakeEvent({
          orderId,
          items: [
            { productId: productWithStock, quantity: 5, price: "1.00" },
            { productId: productMissing, quantity: 1, price: "1.00" },
          ],
        }),
      ),
    ).rejects.toThrow(
      `Cannot process order ${orderId}: no inventory record for product(s) ${productMissing}`,
    );

    // Atomicity: the item that does exist must not have been decremented —
    // the check happens before the transaction even starts.
    const inventory = await prisma.inventory.findUnique({ where: { productId: productWithStock } });
    expect(inventory?.stock).toBe(10);

    const processedCount = await prisma.processedMessage.count({ where: { messageId } });
    expect(processedCount).toBe(0);
  });
});
