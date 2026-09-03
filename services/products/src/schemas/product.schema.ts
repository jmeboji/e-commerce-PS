import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.number().positive(),
  sku: z.string().min(1),
  stock: z.number().int().nonnegative(),
});

export const updateProductSchema = createProductSchema.partial();

export const productIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Shared wire contract with recommendations (Python) over the
// product_changed SNS topic — name/description only matter for
// created/updated, since that's what gets embedded; deleted only carries
// enough to remove the row (existing productId).
const productChangedFieldsSchema = z.object({
  productId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
});

export const productCreatedEventSchema = productChangedFieldsSchema.extend({
  eventType: z.literal("created"),
});

export const productUpdatedEventSchema = productChangedFieldsSchema.extend({
  eventType: z.literal("updated"),
});

export const productDeletedEventSchema = z.object({
  eventType: z.literal("deleted"),
  productId: z.string().uuid(),
});

export const productChangedEventSchema = z.discriminatedUnion("eventType", [
  productCreatedEventSchema,
  productUpdatedEventSchema,
  productDeletedEventSchema,
]);

export type ProductChangedEvent = z.infer<typeof productChangedEventSchema>;
