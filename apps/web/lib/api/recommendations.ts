import { env } from "@/lib/env";

export interface RecommendedProduct {
  product_id: string;
  name: string;
  description: string;
  price: string;
  score: number;
}

export interface SearchResult {
  answer: string;
  products: RecommendedProduct[];
}

export async function search(query: string): Promise<SearchResult> {
  const res = await fetch(`${env.RECOMMENDATIONS_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Recommendations service responded with ${res.status}`);
  return (await res.json()) as SearchResult;
}
