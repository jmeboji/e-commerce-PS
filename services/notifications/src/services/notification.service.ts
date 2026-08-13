import { prisma } from "../db/prisma.js";
import type { OrderCreatedEvent } from "../schemas/notification.schema.js";

// Idempotency key is the SQS messageId (mirrors inventory's ProcessedMessage
// pattern) — orderId is no longer unique on NotificationLog, so nothing
// prevents two distinct messageIds for the same order each logging their own
// row; only a redelivery of the same message is deduped.
export async function processOrderCreated(messageId: string, event: OrderCreatedEvent) {
  const alreadyProcessed = await prisma.processedMessage.findUnique({ where: { messageId } });
  if (alreadyProcessed) return; // duplicate delivery, skip silently

  await prisma.$transaction([
    prisma.notificationLog.create({
      data: { orderId: event.orderId, userId: event.userId },
    }),
    prisma.processedMessage.create({ data: { messageId } }),
  ]);

  console.log(`[notifications] would send confirmation email to user ${event.userId} for order ${event.orderId}`);
}

export function getNotificationLogsByOrderId(orderId: string) {
  return prisma.notificationLog.findMany({
    where: { orderId },
    orderBy: { sentAt: "asc" },
  });
}
