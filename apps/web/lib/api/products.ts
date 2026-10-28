import { env } from "@/lib/env";

// Local shape, deliberately not imported from the products service or a
// shared package — mirrors the boundary isolation the backend HTTP clients
// use (services/cart/src/clients/products.client.ts). This is the wire
// contract as this app consumes it; it drifts independently.
export interface ProductResponse {
  id: string;
  name: string;
  description: string;
  price: string;
  sku: string;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export async function listProducts(): Promise<ProductResponse[]> {
  const res = await fetch(`${env.PRODUCTS_URL}/products`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Products service responded with ${res.status}`);
  }
  return (await res.json()) as ProductResponse[];
}

export async function getProductById(
  id: string,
): Promise<ProductResponse | null> {
  const res = await fetch(`${env.PRODUCTS_URL}/products/${id}`, {
    cache: "no-store",
  });
  // 400 is products rejecting a malformed (non-UUID) id. No product can
  // have that id, so it's the same answer as 404 for a caller.
  if (res.status === 404 || res.status === 400) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Products service responded with ${res.status}`);
  }
  return (await res.json()) as ProductResponse;
}
