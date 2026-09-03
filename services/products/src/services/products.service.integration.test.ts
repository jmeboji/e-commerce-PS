import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SQSClient, ReceiveMessageCommand, PurgeQueueCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { prisma } from "../db/prisma.js";
import { createProduct, deleteProduct, updateProduct } from "./products.service.js";

const RECOMMENDATIONS_QUEUE_URL =
  "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/local-recommendations-product-changed-queue";

const sqsClient = new SQSClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

describe("createProduct (integration, real LocalStack SNS/SQS)", () => {
  let createdId: string | undefined;
  let updatedId: string | undefined;

  beforeAll(async () => {
    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: RECOMMENDATIONS_QUEUE_URL })).catch(() => {});
  });

  afterAll(async () => {
    if (createdId) {
      await prisma.product.delete({ where: { id: createdId } }).catch(() => {});
    }
    if (updatedId) {
      await prisma.product.delete({ where: { id: updatedId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("publishes a real ProductChanged(created) event that actually fans out to recommendations_queue", async () => {
    const product = await createProduct({
      name: "Integration Test Widget",
      description: "Published for real, not mocked",
      price: 9.99,
      sku: `WIDGET-INT-${randomUUID()}`,
      stock: 5,
    });
    createdId = product.id;

    // Give LocalStack a moment to actually deliver SNS -> SQS before polling.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const received = await sqsClient.send(
      new ReceiveMessageCommand({ QueueUrl: RECOMMENDATIONS_QUEUE_URL, WaitTimeSeconds: 5 }),
    );
    const message = received.Messages?.[0];
    expect(message).toBeDefined();

    const body = JSON.parse(message!.Body!);
    expect(body).toEqual({
      eventType: "created",
      productId: product.id,
      name: "Integration Test Widget",
      description: "Published for real, not mocked",
    });

    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: RECOMMENDATIONS_QUEUE_URL,
        ReceiptHandle: message!.ReceiptHandle!,
      }),
    );
  }, 15000);

  it("publishes a deleted event with only eventType and productId", async () => {
    const product = await createProduct({
      name: "To Be Deleted",
      description: "Will be removed",
      price: 1,
      sku: `WIDGET-DEL-${randomUUID()}`,
      stock: 1,
    });

    // Drain the created-event message for this second product before
    // triggering the delete, so the next receive unambiguously belongs to it.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sqsClient.send(
      new ReceiveMessageCommand({ QueueUrl: RECOMMENDATIONS_QUEUE_URL, WaitTimeSeconds: 5 }),
    );

    await deleteProduct(product.id);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const received = await sqsClient.send(
      new ReceiveMessageCommand({ QueueUrl: RECOMMENDATIONS_QUEUE_URL, WaitTimeSeconds: 5 }),
    );
    const message = received.Messages?.[0];
    expect(message).toBeDefined();

    const body = JSON.parse(message!.Body!);
    expect(body).toEqual({ eventType: "deleted", productId: product.id });
  }, 15000);

  it("publishes the full current name/description on update, not just the changed field", async () => {
    const product = await createProduct({
      name: "Original Name",
      description: "Original description",
      price: 5,
      sku: `WIDGET-UPD-${randomUUID()}`,
      stock: 3,
    });
    updatedId = product.id;

    // Drain the created-event before the update, same isolation reasoning
    // as the delete test above.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sqsClient.send(
      new ReceiveMessageCommand({ QueueUrl: RECOMMENDATIONS_QUEUE_URL, WaitTimeSeconds: 5 }),
    );

    // Only touch price — description should still publish in full, proving
    // the event isn't built from a partial diff.
    await updateProduct(product.id, { price: 7 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const received = await sqsClient.send(
      new ReceiveMessageCommand({ QueueUrl: RECOMMENDATIONS_QUEUE_URL, WaitTimeSeconds: 5 }),
    );
    const message = received.Messages?.[0];
    expect(message).toBeDefined();

    const body = JSON.parse(message!.Body!);
    expect(body).toEqual({
      eventType: "updated",
      productId: product.id,
      name: "Original Name",
      description: "Original description",
    });
  }, 15000);
});
