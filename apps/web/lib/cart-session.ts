import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createCart, getCartById, type CartResponse } from "@/lib/api/cart";

// Guest identity and cart live in httpOnly cookies: every service call is
// made server-side (the backends don't enable CORS), so the browser never
// needs to read them, only send them back.
const GUEST_ID_COOKIE = "guest_id";
const CART_ID_COOKIE = "cart_id";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
} as const;

// Read-only, safe in Server Components. Returns null when there's no cart
// yet, or the cookie points at a cart that no longer exists. It can't
// repair the cookie (cookies can only be set in a Server Action); the next
// addToCart does that.
export async function getCurrentCart(): Promise<CartResponse | null> {
  const cartId = (await cookies()).get(CART_ID_COOKIE)?.value;
  if (!cartId) return null;
  return getCartById(cartId);
}

// Server Actions only. Carts are created lazily, on the first add, so
// visitors who only browse don't each leave an empty cart row behind.
export async function getOrCreateCart(): Promise<CartResponse> {
  const existing = await getCurrentCart();
  if (existing) return existing;

  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_ID_COOKIE)?.value ?? `guest-${randomUUID()}`;
  const cart = await createCart(guestId);

  cookieStore.set(GUEST_ID_COOKIE, guestId, cookieOptions);
  cookieStore.set(CART_ID_COOKIE, cart.id, cookieOptions);
  return cart;
}
