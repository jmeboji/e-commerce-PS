import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { env } from "../config/env.js";
import type { ProductChangedEvent } from "../schemas/product.schema.js";

// Credentials are dummy values by convention — LocalStack ignores them entirely.
const snsClient = new SNSClient({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

export async function publishProductChanged(
  event: ProductChangedEvent,
): Promise<void> {
  try {
    await snsClient.send(
      new PublishCommand({
        TopicArn: env.PRODUCT_CHANGED_TOPIC_ARN,
        Message: JSON.stringify(event),
      }),
    );
  } catch (err) {
    // Product write is already committed at this point — don't fail the
    // request over a publish failure. Known gap: if this fails,
    // recommendations' embedding index drifts from the real catalog until
    // the next manual scripts/ingest_products.py run. Revisit with a
    // transactional outbox pattern if that drift becomes a real problem.
    console.error(
      `Failed to publish ProductChanged (${event.eventType}) for product ${event.productId}:`,
      err,
    );
  }
}
