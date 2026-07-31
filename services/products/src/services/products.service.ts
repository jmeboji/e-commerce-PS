import { prisma } from "../db/prisma.js";
import { HttpError } from "../middleware/error-handler.js";
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

export function createProduct(input: CreateProductInput) {
  return prisma.product.create({ data: input });
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  await getProduct(id);
  return prisma.product.update({ where: { id }, data: input });
}

export async function deleteProduct(id: string) {
  await getProduct(id);
  await prisma.product.delete({ where: { id } });
}
