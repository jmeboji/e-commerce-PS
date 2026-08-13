import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, type Message } from "@aws-sdk/client-sqs";
import { env } from "../config/env.js";
import { orderCreatedEventSchema } from "../schemas/notification.schema.js";
import { processOrderCreated } from "../services/notification.service.js";

const sqsClient = new SQSClient({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

async function handleMessage(message: Message): Promise<boolean> {
  if (!message.MessageId || !message.ReceiptHandle || !message.Body) {
    console.error("Skipping malformed SQS message (missing id/receipt/body):", message);
    return false;
  }

  try {
    const event = orderCreatedEventSchema.parse(JSON.parse(message.Body));
    await processOrderCreated(message.MessageId, event);

    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: env.EMAIL_QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
    return true;
  } catch (err) {
    // Don't delete on failure — leave it for SQS to redeliver after the
    // visibility timeout, up to the queue's maxReceiveCount, then DLQ.
    console.error(`Failed to process message ${message.MessageId}:`, err);
    return false;
  }
}

// One receive-and-process cycle, exported separately so it can be driven
// directly (e.g. from a test) without needing the infinite loop below.
// Returns the SQS MessageIds that were successfully processed (and thus
// used as ProcessedMessage.messageId) — lets a test identify exactly which
// row it created instead of guessing from a shared table by timestamp.
export async function pollOnce(signal?: AbortSignal): Promise<string[]> {
  const result = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: env.EMAIL_QUEUE_URL,
      WaitTimeSeconds: 20,
      MaxNumberOfMessages: 10,
    }),
    { abortSignal: signal },
  );

  const processedMessageIds: string[] = [];
  for (const message of result.Messages ?? []) {
    const succeeded = await handleMessage(message);
    if (succeeded && message.MessageId) {
      processedMessageIds.push(message.MessageId);
    }
  }
  return processedMessageIds;
}

export async function startOrderPlacedConsumer(signal?: AbortSignal): Promise<void> {
  console.log(`[notifications-worker] polling ${env.EMAIL_QUEUE_URL}`);

  while (!signal?.aborted) {
    try {
      await pollOnce(signal);
    } catch (err) {
      if (signal?.aborted) break;
      console.error("[notifications-worker] poll cycle failed, retrying:", err);
    }
  }

  console.log("[notifications-worker] stopped");
}

// AWS SDK v3 clients keep an HTTP keep-alive connection pool open until
// explicitly destroyed — without this, the Node process never exits on its
// own after a graceful shutdown (tsx/a process supervisor ends up having to
// force-kill it instead).
export function shutdownSqsClient(): void {
  sqsClient.destroy();
}
