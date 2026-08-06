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

  // Aggregate per productId first — two line items for the same product
  // need to be checked against their combined quantity, not independently
  // (two quantity:3 requests could each "pass" against stock:5 when
  // combined they need 6).
  const requestedByProductId = new Map<string, number>();
  for (const item of event.items) {
    requestedByProductId.set(item.productId, (requestedByProductId.get(item.productId) ?? 0) + item.quantity);
  }
  const productIds = [...requestedByProductId.keys()];

  // Interactive transaction, not the array form: `updateMany`'s `stock: {
  // gte }` guard makes the sufficiency check and the decrement one atomic
  // DB operation (closing the read-then-write race a separate pre-check
  // would have), but `updateMany` never throws on zero matched rows — it
  // just returns `{ count: 0 }` as a normal result. With the array form of
  // `$transaction`, that would let the whole batch commit successfully
  // even when one product's check failed, silently decrementing the
  // products that did have stock while "failing" the ones that didn't —
  // exactly the dual-write bug this function exists to prevent. The
  // interactive form lets a thrown error inside the callback roll back
  // everything that ran earlier in the same callback.
  await prisma.$transaction(async (tx) => {
    const failures: string[] = [];

    for (const productId of productIds) {
      const requested = requestedByProductId.get(productId)!;
      const result = await tx.inventory.updateMany({
        where: { productId, stock: { gte: requested } },
        data: { stock: { decrement: requested } },
      });

      if (result.count === 0) {
        // count === 0 means either no inventory record for this product,
        // or insufficient stock — re-read (inside the same transaction, so
        // it's consistent with what we just tried) purely to build a
        // diagnosable error message.
        const row = await tx.inventory.findUnique({ where: { productId } });
        failures.push(
          row === null
            ? `${productId} (no inventory record)`
            : `${productId} (have ${row.stock}, need ${requested})`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(`Cannot process order ${event.orderId}: insufficient stock or missing product(s) ${failures.join(", ")}`);
    }

    await tx.processedMessage.create({ data: { messageId } });
  });
}
