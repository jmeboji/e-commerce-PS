import { env } from "../config/env.js";

export interface CartItemResponse {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  price: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartResponse {
  id: string;
  userId: string;
  items: CartItemResponse[];
  createdAt: string;
  updatedAt: string;
}

export async function getCartById(
  cartId: string,
): Promise<CartResponse | null> {
  const res = await fetch(`${env.CART_SERVICE_URL}/carts/${cartId}`);

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Cart service responded with ${res.status}`);
  }

  return (await res.json()) as CartResponse;
}

export async function clearCart(cartId: string): Promise<void> {
  const res = await fetch(`${env.CART_SERVICE_URL}/carts/${cartId}/items`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Cart service responded with ${res.status} while clearing cart ${cartId}`);
  }
}
