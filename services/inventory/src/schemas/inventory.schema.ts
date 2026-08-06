import { z } from "zod";

export const orderCreatedEventSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
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
