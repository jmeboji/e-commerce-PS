import { z } from "zod";

export const addItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const cartIdParamSchema = z.object({
  cartId: z.string().uuid(),
});

export type AddItemInput = z.infer<typeof addItemSchema>;
