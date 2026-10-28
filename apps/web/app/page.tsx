import Link from "next/link";
import { listProducts } from "@/lib/api/products";
import { formatPrice } from "@/lib/format";

export default async function Home() {
  const products = await listProducts();

  if (products.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">No products yet.</p>;
  }

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold">Products</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <li key={product.id}>
            <Link
              href={`/products/${product.id}`}
              className="flex h-full flex-col gap-2 rounded-lg border border-black/10 p-4 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            >
              <h2 className="font-medium">{product.name}</h2>
              <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                {product.description}
              </p>
              <p className="mt-auto font-semibold">{formatPrice(product.price)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
