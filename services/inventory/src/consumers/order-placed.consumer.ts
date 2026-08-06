import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, type Message } from "@aws-sdk/client-sqs";
import { env } from "../config/env.js";
import { orderCreatedEventSchema } from "../schemas/inventory.schema.js";
import { processOrderCreated } from "../services/inventory.service.js";

const sqsClient = new SQSClient({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

async function handleMessage(message: Message): Promise<void> {
  if (!message.MessageId || !message.ReceiptHandle || !message.Body) {
    console.error("Skipping malformed SQS message (missing id/receipt/body):", message);
    return;
  }

  try {
    const event = orderCreatedEventSchema.parse(JSON.parse(message.Body));
    await processOrderCreated(message.MessageId, event);

    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: env.INVENTORY_QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  } catch (err) {
    // Don't delete on failure — leave it for SQS to redeliver after the
    // visibility timeout, up to the queue's maxReceiveCount, then DLQ.
    console.error(`Failed to process message ${message.MessageId}:`, err);
  }
}

// One receive-and-process cycle, exported separately so it can be driven
// directly (e.g. from a test) without needing the infinite loop below.
export async function pollOnce(signal?: AbortSignal): Promise<void> {
  const result = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: env.INVENTORY_QUEUE_URL,
      WaitTimeSeconds: 20,
      MaxNumberOfMessages: 10,
    }),
    { abortSignal: signal },
  );

  for (const message of result.Messages ?? []) {
    await handleMessage(message);
  }
}

export async function startOrderPlacedConsumer(signal?: AbortSignal): Promise<void> {
  console.log(`[inventory-worker] polling ${env.INVENTORY_QUEUE_URL}`);

  while (!signal?.aborted) {
    try {
      await pollOnce(signal);
    } catch (err) {
      if (signal?.aborted) return;
      console.error("[inventory-worker] poll cycle failed, retrying:", err);
    }
  }

  console.log("[inventory-worker] stopped");
}
