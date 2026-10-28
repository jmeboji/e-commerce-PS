import { env } from "@/lib/env";

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

export async function createCart(userId: string): Promise<CartResponse> {
  const res = await fetch(`${env.CART_URL}/carts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`Cart service responded with ${res.status}`);
  return (await res.json()) as CartResponse;
}

export async function getCartById(cartId: string): Promise<CartResponse | null> {
  const res = await fetch(`${env.CART_URL}/carts/${cartId}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cart service responded with ${res.status}`);
  return (await res.json()) as CartResponse;
}

export async function addItemToCart(
  cartId: string,
  productId: string,
  quantity: number,
): Promise<CartItemResponse> {
  const res = await fetch(`${env.CART_URL}/carts/${cartId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, quantity }),
  });
  if (!res.ok) throw new Error(`Cart service responded with ${res.status}`);
  return (await res.json()) as CartItemResponse;
}

export async function clearCart(cartId: string): Promise<void> {
  const res = await fetch(`${env.CART_URL}/carts/${cartId}/items`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Cart service responded with ${res.status}`);
}
