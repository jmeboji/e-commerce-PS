import { prisma } from "../db/prisma.js";
import { HttpError } from "../middleware/error-handler.js";
import { publishProductChanged } from "../clients/sns.client.js";
import type { CreateProductInput, UpdateProductInput } from "../schemas/product.schema.js";

export function listProducts() {
  return prisma.product.findMany();
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    throw new HttpError(404, `Product ${id} not found`);
  }
  return product;
}

export async function createProduct(input: CreateProductInput) {
  const product = await prisma.product.create({ data: input });
  await publishProductChanged({
    eventType: "created",
    productId: product.id,
    name: product.name,
    description: product.description,
  });
  return product;
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  await getProduct(id);
  const product = await prisma.product.update({ where: { id }, data: input });
  // Always publish the full current name/description, not just the fields
  // this particular PATCH touched — recommendations needs the complete text
  // to re-embed, not a delta.
  await publishProductChanged({
    eventType: "updated",
    productId: product.id,
    name: product.name,
    description: product.description,
  });
  return product;
}

export async function deleteProduct(id: string) {
  await getProduct(id);
  await prisma.product.delete({ where: { id } });
  await publishProductChanged({ eventType: "deleted", productId: id });
}
