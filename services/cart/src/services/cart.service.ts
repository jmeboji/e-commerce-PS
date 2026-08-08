import { prisma } from "../db/prisma.js";
import { HttpError } from "../middleware/error-handler.js";
import { getProductById } from "../clients/products.client.js";
import type { AddItemInput } from "../schemas/cart.schema.js";

export async function getCartWithItems(cartId: string) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: true },
  });
  if (!cart) {
    throw new HttpError(404, `Cart ${cartId} not found`);
  }
  return cart;
}

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

export async function clearCart(cartId: string) {
  // Confirm the cart exists first, same 404 pattern as everywhere else —
  // don't let deleteMany silently no-op against a cart that was never real.
  await getCartWithItems(cartId);

  // Deletes CartItem rows only, not the Cart itself — a returning user keeps
  // a valid cartId to add new items to, instead of needing a brand new cart.
  await prisma.cartItem.deleteMany({ where: { cartId } });
}
