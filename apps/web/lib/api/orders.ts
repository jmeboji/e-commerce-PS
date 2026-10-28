import { env } from "@/lib/env";

export interface OrderItemResponse {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: string;
  createdAt: string;
}

export interface OrderResponse {
  id: string;
  userId: string;
  status: string;
  total: string;
  items: OrderItemResponse[];
  createdAt: string;
  updatedAt: string;
}

export async function createOrder(userId: string, cartId: string): Promise<OrderResponse> {
  const res = await fetch(`${env.ORDERS_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, cartId }),
  });
  if (!res.ok) throw new Error(`Orders service responded with ${res.status}`);
  return (await res.json()) as OrderResponse;
}

export async function getOrderById(id: string): Promise<OrderResponse | null> {
  const res = await fetch(`${env.ORDERS_URL}/orders/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Orders service responded with ${res.status}`);
  return (await res.json()) as OrderResponse;
}
