import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SQSClient, PurgeQueueCommand, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { pollOnce } from "./order-placed.consumer.js";
import type { OrderCreatedEvent } from "../schemas/notification.schema.js";

const snsClient = new SNSClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

const sqsClient = new SQSClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

// Same topic ARN orders publishes to — bypassing orders entirely and
// publishing directly is sufficient here, since orders.service.integration.test.ts
// already proves the orders -> SNS -> SQS leg independently. This test's job
// is proving the other half: SQS -> notifications' poller -> DB.
const TOPIC_ARN = "arn:aws:sns:us-east-1:000000000000:local-orders-order-placed-topic";

async function publishOrderCreated(event: OrderCreatedEvent): Promise<void> {
  await snsClient.send(
    new PublishCommand({ TopicArn: TOPIC_ARN, Message: JSON.stringify(event) }),
  );
}

describe("order-placed consumer (integration, real LocalStack SNS/SQS)", () => {
  let orderId: string;
  let processedMessageIds: string[] = [];

  beforeAll(async () => {
    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: env.EMAIL_QUEUE_URL })).catch(() => {});
  });

  afterEach(async () => {
    if (orderId) {
      await prisma.notificationLog.deleteMany({ where: { orderId } });
    }
    if (processedMessageIds.length > 0) {
      await prisma.processedMessage.deleteMany({ where: { messageId: { in: processedMessageIds } } });
      processedMessageIds = [];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("receives a real published message, records a notification, and deletes the message from the queue", async () => {
    const event: OrderCreatedEvent = {
      orderId: randomUUID(),
      userId: randomUUID(),
      total: "20.00",
      items: [{ productId: randomUUID(), quantity: 4, price: "5.00" }],
    };
    orderId = event.orderId;

    await publishOrderCreated(event);

    // Give LocalStack a moment to actually deliver SNS -> SQS before polling.
    await new Promise((resolve) => setTimeout(resolve, 500));

    processedMessageIds = await pollOnce();
    expect(processedMessageIds).toHaveLength(1);

    const logs = await prisma.notificationLog.findMany({ where: { orderId: event.orderId } });
    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBe(event.userId);

    // Confirm the message is actually gone from the queue, not just that
    // handleMessage() returned true — proves DeleteMessageCommand really ran.
    const remaining = await sqsClient.send(
      new ReceiveMessageCommand({ QueueUrl: env.EMAIL_QUEUE_URL, WaitTimeSeconds: 2 }),
    );
    expect(remaining.Messages ?? []).toHaveLength(0);
  }, 15000);
});
