import Link from "next/link";
import { getProductById } from "@/lib/api/products";
import { getCurrentCart } from "@/lib/cart-session";
import { formatPrice } from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { clearCurrentCart } from "./actions";

export default async function CartPage() {
  const cart = await getCurrentCart();

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Your cart</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Your cart is empty.</p>
        <Link href="/" className="underline">
          Browse products
        </Link>
      </div>
    );
  }

  // Cart items only carry productId/quantity/price, so names come from
  // products. null means the product was deleted after it was added.
  const products = await Promise.all(cart.items.map((item) => getProductById(item.productId)));

  // item.price is the price snapshotted when the item was first added. That's
  // what an order built from this cart charges, so show it, not today's price.
  const totalCents = cart.items.reduce((sum, item) => sum + toCents(item.price) * item.quantity, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Your cart</h1>
      <ul className="divide-y divide-black/10 border-y border-black/10 dark:divide-white/15 dark:border-white/15">
        {cart.items.map((item, i) => {
          const product = products[i];
          return (
            <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-4">
              <div className="flex flex-col">
                {product ? (
                  <Link href={`/products/${product.id}`} className="font-medium hover:underline">
                    {product.name}
                  </Link>
                ) : (
                  <span className="font-medium text-zinc-500">No longer available</span>
                )}
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {item.quantity} × {formatPrice(item.price)}
                </span>
              </div>
              <span className="font-medium">{formatPrice(fromCents(toCents(item.price) * item.quantity))}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <form action={clearCurrentCart}>
          <button
            type="submit"
            className="rounded-md border border-black/20 px-4 py-2 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
          >
            Clear cart
          </button>
        </form>
        <p className="text-lg font-semibold">Total {formatPrice(fromCents(totalCents))}</p>
      </div>
    </div>
  );
}
