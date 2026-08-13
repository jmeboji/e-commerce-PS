import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.js";
import { processOrderCreated, getNotificationLogsByOrderId } from "./notification.service.js";
import type { OrderCreatedEvent } from "../schemas/notification.schema.js";

function fakeEvent(overrides: Partial<OrderCreatedEvent> = {}): OrderCreatedEvent {
  return {
    orderId: randomUUID(),
    userId: randomUUID(),
    total: "25.25",
    items: [],
    ...overrides,
  };
}

describe("processOrderCreated", () => {
  let orderIds: string[];
  let messageIds: string[];

  beforeEach(() => {
    orderIds = [];
    messageIds = [];
  });

  afterEach(async () => {
    await prisma.notificationLog.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.processedMessage.deleteMany({ where: { messageId: { in: messageIds } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("logs a notification recording the order's userId", async () => {
    const event = fakeEvent();
    orderIds.push(event.orderId);
    const messageId = randomUUID();
    messageIds.push(messageId);

    await processOrderCreated(messageId, event);

    const logs = await prisma.notificationLog.findMany({ where: { orderId: event.orderId } });
    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBe(event.userId);
  });

  it("is idempotent: a repeat call with the same messageId is a no-op", async () => {
    const event = fakeEvent();
    orderIds.push(event.orderId);
    const messageId = randomUUID();
    messageIds.push(messageId);

    await processOrderCreated(messageId, event);
    await processOrderCreated(messageId, event);

    const logs = await prisma.notificationLog.findMany({ where: { orderId: event.orderId } });
    expect(logs).toHaveLength(1);

    const processedCount = await prisma.processedMessage.count({ where: { messageId } });
    expect(processedCount).toBe(1);
  });

  it("logs a separate row for a distinct messageId even for the same order", async () => {
    const orderId = randomUUID();
    orderIds.push(orderId);
    const messageId1 = randomUUID();
    const messageId2 = randomUUID();
    messageIds.push(messageId1, messageId2);

    await processOrderCreated(messageId1, fakeEvent({ orderId }));
    await processOrderCreated(messageId2, fakeEvent({ orderId }));

    const logs = await prisma.notificationLog.findMany({ where: { orderId } });
    expect(logs).toHaveLength(2);
  });
});

describe("getNotificationLogsByOrderId", () => {
  let orderId: string;
  let messageIds: string[];

  beforeEach(() => {
    messageIds = [];
  });

  afterEach(async () => {
    if (orderId) {
      await prisma.notificationLog.deleteMany({ where: { orderId } });
    }
    await prisma.processedMessage.deleteMany({ where: { messageId: { in: messageIds } } });
  });

  it("returns an empty array when no notification has been logged for the order", async () => {
    const logs = await getNotificationLogsByOrderId(randomUUID());
    expect(logs).toEqual([]);
  });

  it("returns all logged entries for a known order", async () => {
    const event = fakeEvent();
    orderId = event.orderId;
    const messageId = randomUUID();
    messageIds.push(messageId);
    await processOrderCreated(messageId, event);

    const logs = await getNotificationLogsByOrderId(orderId);

    expect(logs).toHaveLength(1);
    expect(logs[0].orderId).toBe(orderId);
    expect(logs[0].userId).toBe(event.userId);
  });
});
