import { prisma } from "../db/prisma.js";
import type { OrderCreatedEvent } from "../schemas/inventory.schema.js";

// Stock decrements and the "mark as processed" write must succeed or fail
// together — unlike the best-effort SNS publish in orders (a cross-service
// network call with no local transaction available), this is entirely
// within inventory's own database, so a real transaction is free. There's
// no equivalent excuse to accept a dual-write gap here.
export async function processOrderCreated(messageId: string, event: OrderCreatedEvent) {
  const alreadyProcessed = await prisma.processedMessage.findUnique({ where: { messageId } });
  if (alreadyProcessed) return; // duplicate delivery, skip silently

  // Fail fast with a clear error if any referenced product has no inventory
  // record, rather than letting a mid-transaction Prisma P2025 do it — same
  // outcome (nothing commits, message retries then DLQs), but this is the
  // difference between a diagnosable error and a stack trace someone has to
  // decode at 2am. Checked before the transaction starts, so this can never
  // partially decrement stock for the items that do exist.
  const productIds = event.items.map((item) => item.productId);
  const existingRows = await prisma.inventory.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true },
  });
  const existingIds = new Set(existingRows.map((row) => row.productId));
  const missingIds = productIds.filter((id) => !existingIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(
      `Cannot process order ${event.orderId}: no inventory record for product(s) ${missingIds.join(", ")}`,
    );
  }

  await prisma.$transaction([
    ...event.items.map((item) =>
      prisma.inventory.update({
        where: { productId: item.productId },
        data: { stock: { decrement: item.quantity } },
      }),
    ),
    prisma.processedMessage.create({ data: { messageId } }),
  ]);
}
