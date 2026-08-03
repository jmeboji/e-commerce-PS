import { env } from "../config/env.js";

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

export async function getProductById(id: string): Promise<ProductResponse | null> {
  const res = await fetch(`${env.PRODUCTS_SERVICE_URL}/products/${id}`);

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Products service responded with ${res.status}`);
  }

  return (await res.json()) as ProductResponse;
}
