import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SQSClient, PurgeQueueCommand, GetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { pollOnce } from "./order-placed.consumer.js";

// The topic orders publishes OrderCreated to. Not in inventory's own env
// since inventory never needs it at runtime (it only consumes from SQS) —
// this test is the one exception that needs to reach upstream to simulate
// a real publish.
const ORDER_PLACED_TOPIC_ARN = "arn:aws:sns:us-east-1:000000000000:local-orders-order-placed-topic";

const snsClient = new SNSClient({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

const sqsClient = new SQSClient({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

describe("order-placed consumer (integration, real SNS publish + real SQS poll)", () => {
  let productId: string;

  beforeEach(async () => {
    // Clean slate so this test can be sure the only message it receives is
    // the one it publishes itself.
    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: env.INVENTORY_QUEUE_URL })).catch(() => {});

    productId = randomUUID();
    await prisma.inventory.create({ data: { productId, stock: 20 } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("decrements real stock after a real SNS publish and a real poll cycle", async () => {
    const orderId = randomUUID();
    const userId = randomUUID();

    await snsClient.send(
      new PublishCommand({
        TopicArn: ORDER_PLACED_TOPIC_ARN,
        Message: JSON.stringify({
          orderId,
          userId,
          total: "15.00",
          items: [{ productId, quantity: 5, price: "3.00" }],
        }),
      }),
    );

    const beforePoll = new Date();

    // One real long-poll receive cycle against the real queue — no manual
    // sleep needed, ReceiveMessageCommand's WaitTimeSeconds absorbs any
    // SNS -> SQS propagation delay by waiting for the message to appear.
    await pollOnce();

    const inventory = await prisma.inventory.findUnique({ where: { productId } });
    expect(inventory?.stock).toBe(15);

    // Prove the message was actually deleted after processing, not just
    // that processOrderCreated() didn't throw.
    const attrs = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: env.INVENTORY_QUEUE_URL,
        AttributeNames: ["ApproximateNumberOfMessages"],
      }),
    );
    expect(attrs.Attributes?.ApproximateNumberOfMessages).toBe("0");

    // The SQS-assigned MessageId (used as the idempotency key) is never
    // exposed back to this test, so find the ProcessedMessage row this
    // poll cycle created by timestamp rather than by id.
    const processedRow = await prisma.processedMessage.findFirst({
      where: { processedAt: { gte: beforePoll } },
      orderBy: { processedAt: "desc" },
    });
    expect(processedRow).toBeDefined();

    await prisma.inventory.delete({ where: { productId } });
    if (processedRow) {
      await prisma.processedMessage.delete({ where: { id: processedRow.id } });
    }
  }, 25000);
});
