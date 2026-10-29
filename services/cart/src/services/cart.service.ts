import { Prisma } from "../generated/prisma/index.js";
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

// Get-or-create: userId is @unique on Cart (one cart per user), so a second
// POST for the same user returns that user's existing cart instead of
// failing. Create-then-catch rather than findUnique-then-create, so two
// concurrent calls can't both pass a "no cart yet" check and race — the
// unique index decides, same as upsert_product_embedding's ON CONFLICT.
export async function createCart(userId: string) {
  try {
    const cart = await prisma.cart.create({
      data: { userId },
      include: { items: true },
    });
    return { cart, created: true };
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
      throw err;
    }
    const cart = await prisma.cart.findUniqueOrThrow({
      where: { userId },
      include: { items: true },
    });
    return { cart, created: false };
  }
}
