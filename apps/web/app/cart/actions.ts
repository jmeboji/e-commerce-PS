"use server";

import { refresh } from "next/cache";
import { addItemToCart, clearCart } from "@/lib/api/cart";
import { getCurrentCart, getOrCreateCart } from "@/lib/cart-session";

export type AddToCartState = { status: "idle" | "added" | "error"; message: string };

const MAX_QUANTITY = 99;

export async function addToCart(
  _prevState: AddToCartState,
  formData: FormData,
): Promise<AddToCartState> {
  // Server Actions are reachable by direct POST, not just this form, so
  // validate here rather than trusting the input's min/max.
  const productId = formData.get("productId");
  const quantity = Number(formData.get("quantity"));
  if (typeof productId !== "string" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return { status: "error", message: `Choose a quantity between 1 and ${MAX_QUANTITY}.` };
  }

  try {
    const cart = await getOrCreateCart();
    await addItemToCart(cart.id, productId, quantity);
  } catch (err) {
    console.error(`addToCart failed for product ${productId}:`, err);
    return { status: "error", message: "Couldn't add this to your cart. Please try again." };
  }

  refresh();
  return { status: "added", message: quantity === 1 ? "Added to cart." : `Added ${quantity} to cart.` };
}

export async function clearCurrentCart(): Promise<void> {
  const cart = await getCurrentCart();
  if (!cart) return;
  await clearCart(cart.id);
  refresh();
}
