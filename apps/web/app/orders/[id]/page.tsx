import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/api/orders";
import { getProductById } from "@/lib/api/products";
import { getGuestId } from "@/lib/cart-session";
import { formatPrice } from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";

export default async function OrderPage(props: PageProps<"/orders/[id]">) {
  const { id } = await props.params;
  const [order, guestId] = await Promise.all([getOrderById(id), getGuestId()]);

  // Order ids end up in URLs, logs and events, so holding one isn't proof
  // of ownership. Someone else's order gets the same 404 as a missing one,
  // so the page doesn't confirm that an id exists.
  if (!order || order.userId !== guestId) {
    notFound();
  }

  const products = await Promise.all(order.items.map((item) => getProductById(item.productId)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Order placed</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Order {order.id} · {new Date(order.createdAt).toLocaleString("en-US")}
        </p>
      </div>
      <ul className="divide-y divide-black/10 border-y border-black/10 dark:divide-white/15 dark:border-white/15">
        {order.items.map((item, i) => {
          const product = products[i];
          return (
            <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-4">
              <div className="flex flex-col">
                <span className="font-medium">{product?.name ?? "No longer available"}</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {item.quantity} × {formatPrice(item.price)}
                </span>
              </div>
              <span className="font-medium">{formatPrice(fromCents(toCents(item.price) * item.quantity))}</span>
            </li>
          );
        })}
      </ul>
      <p className="self-end text-lg font-semibold">Total {formatPrice(order.total)}</p>
      <Link href="/" className="underline">
        Continue shopping
      </Link>
    </div>
  );
}
