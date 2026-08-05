import { z } from "zod";

export const createOrderSchema = z.object({
  userId: z.string().uuid(),
  cartId: z.string().uuid(),
});

export const orderIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
