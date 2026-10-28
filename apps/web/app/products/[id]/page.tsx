import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartForm } from "@/components/add-to-cart-form";
import { getProductById } from "@/lib/api/products";
import { formatPrice } from "@/lib/format";

export default async function ProductPage(props: PageProps<"/products/[id]">) {
  const { id } = await props.params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <article className="flex flex-col gap-4">
      <Link href="/" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
        ← All products
      </Link>
      <h1 className="text-2xl font-semibold">{product.name}</h1>
      <p className="text-xl font-semibold">{formatPrice(product.price)}</p>
      <p className="max-w-prose text-zinc-700 dark:text-zinc-300">{product.description}</p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"} · SKU {product.sku}
      </p>
      <AddToCartForm productId={product.id} inStock={product.stock > 0} />
    </article>
  );
}
