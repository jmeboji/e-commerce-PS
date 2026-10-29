import { Suspense } from "react";
import Link from "next/link";
import { search, SearchUnavailableError } from "@/lib/api/recommendations";
import { formatPrice } from "@/lib/format";

// Matches the input's maxLength; enforced here too since the URL is
// user-editable and the query is sent on to an LLM.
const MAX_QUERY_LENGTH = 200;

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const query = (typeof q === "string" ? q : "").trim().slice(0, MAX_QUERY_LENGTH);

  if (!query) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Describe what you&apos;re looking for, like &ldquo;shoes for jogging&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Results for &ldquo;{query}&rdquo;</h1>
      {/* Keyed on the query so a new search shows the fallback again instead
          of leaving the previous results up while the next ones load. */}
      <Suspense key={query} fallback={<p className="text-zinc-600 dark:text-zinc-400">Searching…</p>}>
        <SearchResults query={query} />
      </Suspense>
    </div>
  );
}

async function SearchResults({ query }: { query: string }) {
  let result;
  try {
    result = await search(query);
  } catch (err) {
    if (!(err instanceof SearchUnavailableError)) throw err;
    console.error(`search unavailable for query "${query}":`, err);
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        Search is unavailable right now. Please try again in a moment, or{" "}
        <Link href="/" className="underline">
          browse all products
        </Link>
        .
      </p>
    );
  }

  if (result.products.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">No matching products found.</p>;
  }

  return (
    <>
      <p className="max-w-prose rounded-lg bg-black/5 p-4 dark:bg-white/10">{result.answer}</p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {result.products.map((product) => (
          <li key={product.product_id}>
            <Link
              href={`/products/${product.product_id}`}
              className="flex h-full flex-col gap-2 rounded-lg border border-black/10 p-4 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            >
              <h2 className="font-medium">{product.name}</h2>
              <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{product.description}</p>
              <p className="mt-auto font-semibold">{formatPrice(product.price)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
