import { z } from "zod";

// userId is min(1), not uuid(), to match orders' createOrderSchema: guest
// checkout userIds are client-minted, not UUIDs. A stricter rule here would
// reject every guest OrderCreated event, leaving it to redeliver into the
// DLQ after the order has already committed.
export const orderCreatedEventSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().min(1),
  total: z.string(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
      price: z.string(),
    }),
  ),
});

export type OrderCreatedEvent = z.infer<typeof orderCreatedEventSchema>;

export const orderIdParamSchema = z.object({
  orderId: z.string().uuid(),
});
