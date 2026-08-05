import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { env } from "../config/env.js";

// Credentials are dummy values by convention — LocalStack ignores them entirely.
const snsClient = new SNSClient({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

export interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  total: string;
  items: Array<{ productId: string; quantity: number; price: string }>;
}

export async function publishOrderCreated(
  event: OrderCreatedEvent,
): Promise<void> {
  try {
    await snsClient.send(
      new PublishCommand({
        TopicArn: env.ORDER_CREATED_TOPIC_ARN,
        Message: JSON.stringify(event),
      }),
    );
  } catch (err) {
    // Order is already committed at this point — don't fail the request
    // over a publish failure. Known gap: if this fails, inventory/notifications
    // never hear about this order. Revisit with a transactional outbox pattern
    // once inventory exists and this failure mode has real consequences.
    console.error(
      `Failed to publish OrderCreated for order ${event.orderId}:`,
      err,
    );
  }
}
