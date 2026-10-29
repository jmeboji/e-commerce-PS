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

// recommendations unreachable, or answering 503 (products, which it
// enriches every match from, is down). Both mean "search is temporarily
// unavailable" to a shopper, and both are retryable, so callers can show a
// message instead of an error page. Anything else stays a plain Error.
export class SearchUnavailableError extends Error {}

export async function search(query: string): Promise<SearchResult> {
  let res: Response;
  try {
    res = await fetch(`${env.RECOMMENDATIONS_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
  } catch (err) {
    throw new SearchUnavailableError("Could not reach the recommendations service", { cause: err });
  }
  if (res.status === 503) throw new SearchUnavailableError("Recommendations service responded with 503");
  if (!res.ok) throw new Error(`Recommendations service responded with ${res.status}`);
  return (await res.json()) as SearchResult;
}
