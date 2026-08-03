import { prisma } from "../db/prisma.js";
import { HttpError } from "../middleware/error-handler.js";
import { getProductById } from "../clients/products.client.js";
import type { AddItemInput } from "../schemas/cart.schema.js";

export async function addItemToCart(cartId: string, input: AddItemInput) {
  const product = await getProductById(input.productId);
  if (!product) {
    throw new HttpError(404, `Product ${input.productId} not found`);
  }

  return prisma.cartItem.upsert({
    where: {
      cartId_productId: {
        cartId,
        productId: input.productId,
      },
    },
    update: {
      quantity: { increment: input.quantity },
    },
    create: {
      cartId,
      productId: input.productId,
      quantity: input.quantity,
      price: product.price,
    },
  });
}
